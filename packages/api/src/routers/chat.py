"""Chat API endpoints with streaming support.

Supports comprehensive agent settings for fine-grained control:
- Agent Type (Coder, Analyst, Creative Writer, etc.)
- Metacognitive Type (Chain of Thought, Tree of Thought, etc.)
- Voice Type (Professional, Friendly, Concise, etc.)
- IAP (Instance-Adaptive Prompting) settings
- Advanced model parameters (temperature, penalties, etc.)
"""

import os
from typing import Optional, Literal
from enum import Enum

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


# ============================================================================
# Enums for Agent Settings
# ============================================================================

class ChatMode(str, Enum):
    GENERAL = "general"
    CODE = "code"
    CREATIVE = "creative"
    ANALYSIS = "analysis"


class CoTStrategy(str, Enum):
    NONE = "none"
    CHAIN_OF_THOUGHT = "chain-of-thought"
    IAP_SS = "iap-ss"  # Single-saliency
    IAP_MV = "iap-mv"  # Multi-vote
    TREE_OF_THOUGHT = "tree-of-thought"


# ============================================================================
# Agent Settings Models
# ============================================================================

class IAPSettings(BaseModel):
    """Instance-Adaptive Prompting settings for advanced thinking."""
    enabled: bool = False
    strategy: CoTStrategy = CoTStrategy.NONE
    saliencyThreshold: float = Field(default=0.5, ge=0.0, le=1.0)
    topPromptsCount: int = Field(default=3, ge=1, le=10)


class ThinkingStep(BaseModel):
    """Custom thinking step for structured reasoning."""
    id: str
    name: str
    prompt: str
    enabled: bool = True


class AgentSettings(BaseModel):
    """Comprehensive agent configuration settings."""
    chatMode: ChatMode = ChatMode.GENERAL
    agentType: Optional[str] = None
    metacognitiveType: Optional[str] = None
    voiceType: Optional[str] = None
    enableToolUse: bool = False
    enableRAG: bool = False
    corpusId: Optional[str] = None
    enableEpisodicMemory: bool = False
    enableWorkspaceContext: bool = False
    enableAdvancedThinking: bool = False
    iapSettings: Optional[IAPSettings] = None
    customThinkingSteps: Optional[list[ThinkingStep]] = None
    systemPromptOverride: Optional[str] = None


class Message(BaseModel):
    """Chat message with optional multimodal support."""
    role: str  # "user", "assistant", "system"
    content: str
    images: Optional[list[str]] = None


class ChatRequest(BaseModel):
    """Chat completion request with full agent settings support."""
    model: str
    messages: list[Message]
    stream: bool = True
    format: Optional[str] = None
    options: Optional[dict] = None
    tools: Optional[list[dict]] = None
    agentSettings: Optional[AgentSettings] = None


class ChatResponse(BaseModel):
    model: str
    message: Message
    done: bool
    total_duration: Optional[int] = None
    load_duration: Optional[int] = None
    prompt_eval_count: Optional[int] = None
    prompt_eval_duration: Optional[int] = None
    eval_count: Optional[int] = None
    eval_duration: Optional[int] = None


# ============================================================================
# Agent Settings Processing
# ============================================================================

# Metacognitive prompting templates
METACOGNITIVE_PROMPTS = {
    "chain-of-thought": "Think through this step by step. Before providing your final answer, work through the problem systematically, showing your reasoning at each step.",
    "visualization-of-thought": "Visualize the problem space mentally. Describe what you 'see' as you think through the problem, using spatial and visual metaphors to explore the solution.",
    "tree-of-thought": "Consider multiple possible approaches. For each approach, explore the implications and potential outcomes before selecting the best path forward.",
    "self-reflection": "After formulating your initial response, critically examine it. Consider what assumptions you made, what you might have missed, and how you could improve your answer.",
    "socratic": "Approach this by asking and answering a series of probing questions. Each question should deepen understanding and lead toward the solution.",
    "first-principles": "Break this down to its fundamental truths. Start from basic principles and build up your reasoning without relying on assumptions or conventions.",
}

# IAP (Instance-Adaptive Prompting) and CoT templates
IAP_TEMPLATES = {
    "chain-of-thought": "Think through this step-by-step. Break down the problem into smaller parts and reason through each one carefully before reaching your conclusion.",
    "iap-ss": "Focus on the most salient aspects of this problem. Identify the key elements that are most relevant to finding a solution, and concentrate your reasoning there.",
    "iap-mv": "Consider this problem from multiple perspectives. Generate several candidate approaches, evaluate each one, and synthesize the best elements into your final answer.",
    "tree-of-thought": "Explore multiple reasoning paths like branches of a tree. For each approach, consider its implications, then evaluate and prune less promising branches to find the optimal solution.",
}


def build_thinking_prompt(settings: AgentSettings) -> Optional[str]:
    """Build enhanced thinking prompt based on agent settings."""
    prompts = []

    # Add metacognitive prompting if specified
    if settings.metacognitiveType:
        metacog_key = settings.metacognitiveType.lower().replace(" ", "-").replace("_", "-")
        if metacog_key in METACOGNITIVE_PROMPTS:
            prompts.append(METACOGNITIVE_PROMPTS[metacog_key])

    # Add IAP prompting if enabled
    if settings.enableAdvancedThinking and settings.iapSettings and settings.iapSettings.enabled:
        strategy_key = settings.iapSettings.strategy.value
        if strategy_key in IAP_TEMPLATES:
            prompts.append(IAP_TEMPLATES[strategy_key])

    # Add custom thinking steps
    if settings.customThinkingSteps:
        enabled_steps = [s for s in settings.customThinkingSteps if s.enabled]
        if enabled_steps:
            steps_text = "\n".join([f"- {s.name}: {s.prompt}" for s in enabled_steps])
            prompts.append(f"Follow these thinking steps:\n{steps_text}")

    return "\n\n".join(prompts) if prompts else None


def process_messages_with_settings(
    messages: list[Message],
    settings: Optional[AgentSettings]
) -> list[dict]:
    """Process messages and inject agent settings into system prompt."""
    processed = []

    for msg in messages:
        msg_dict = msg.model_dump(exclude_none=True)

        # Enhance system message with thinking prompts
        if msg.role == "system" and settings:
            thinking_prompt = build_thinking_prompt(settings)
            if thinking_prompt:
                msg_dict["content"] = f"{msg.content}\n\n{thinking_prompt}"

        processed.append(msg_dict)

    return processed


def build_ollama_request(request: ChatRequest) -> dict:
    """Build the Ollama API request with all settings applied."""
    # Process messages with agent settings
    processed_messages = process_messages_with_settings(
        request.messages,
        request.agentSettings
    )

    # Build base request
    ollama_request = {
        "model": request.model,
        "messages": processed_messages,
        "stream": request.stream,
    }

    # Add optional fields if present
    if request.format:
        ollama_request["format"] = request.format

    if request.options:
        ollama_request["options"] = request.options

    # Add tools if tool use is enabled
    if request.tools and request.agentSettings and request.agentSettings.enableToolUse:
        ollama_request["tools"] = request.tools
    elif request.tools:
        # Include tools even without explicit enableToolUse flag
        ollama_request["tools"] = request.tools

    return ollama_request


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("")
async def chat(request: ChatRequest):
    """Chat completion endpoint with streaming support.

    Supports comprehensive agent settings for fine-grained control:
    - Agent Type, Metacognitive Type, Voice Type
    - IAP (Instance-Adaptive Prompting) with ss/mv strategies
    - Advanced model parameters (temperature, penalties, etc.)
    - Tool use, RAG, episodic memory flags
    """
    # Build the Ollama request with all settings applied
    ollama_request = build_ollama_request(request)

    async def stream_chat():
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                # Use stream=True for streaming request
                stream_request = {**ollama_request, "stream": True}
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/chat",
                    json=stream_request
                ) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except httpx.HTTPError as e:
                yield f'{{"error": "Connection failed: {str(e)}"}}\n'.encode()

    if request.stream:
        return StreamingResponse(
            stream_chat(),
            media_type="application/x-ndjson"
        )
    else:
        # Non-streaming response
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                # Use stream=False for non-streaming request
                sync_request = {**ollama_request, "stream": False}
                response = await client.post(
                    f"{OLLAMA_HOST}/api/chat",
                    json=sync_request
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.post("/completions")
async def openai_compatible_chat(request: dict):
    """OpenAI-compatible chat completions endpoint."""
    # Transform OpenAI format to Ollama format
    messages = [
        Message(role=m["role"], content=m["content"])
        for m in request.get("messages", [])
    ]

    model = request.get("model", "llama3.2")
    stream = request.get("stream", False)

    chat_request = ChatRequest(
        model=model,
        messages=messages,
        stream=stream,
    )

    return await chat(chat_request)
