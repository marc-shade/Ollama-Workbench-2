"""OpenAI-compatible API endpoints.

Provides drop-in compatibility with OpenAI's chat completions API,
allowing tools and applications built for OpenAI to work with local Ollama models.

Supported endpoints:
- POST /v1/chat/completions - Chat completions (streaming and non-streaming)
- GET /v1/models - List available models
"""

import os
import json
import time
import uuid
from typing import Optional, Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


# ============================================================================
# OpenAI API Models
# ============================================================================

class ChatMessage(BaseModel):
    """OpenAI chat message format."""
    role: Literal["system", "user", "assistant", "function", "tool"]
    content: Optional[str] = None
    name: Optional[str] = None
    function_call: Optional[dict] = None
    tool_calls: Optional[list[dict]] = None


class FunctionDefinition(BaseModel):
    """OpenAI function definition."""
    name: str
    description: Optional[str] = None
    parameters: Optional[dict] = None


class ToolDefinition(BaseModel):
    """OpenAI tool definition."""
    type: Literal["function"] = "function"
    function: FunctionDefinition


class ChatCompletionRequest(BaseModel):
    """OpenAI chat completion request."""
    model: str
    messages: list[ChatMessage]
    temperature: Optional[float] = Field(default=1.0, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    n: Optional[int] = Field(default=1, ge=1)
    stream: Optional[bool] = False
    stop: Optional[str | list[str]] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    logit_bias: Optional[dict[str, float]] = None
    user: Optional[str] = None
    functions: Optional[list[FunctionDefinition]] = None
    function_call: Optional[str | dict] = None
    tools: Optional[list[ToolDefinition]] = None
    tool_choice: Optional[str | dict] = None
    response_format: Optional[dict] = None
    seed: Optional[int] = None


class ChatCompletionChoice(BaseModel):
    """OpenAI chat completion choice."""
    index: int
    message: ChatMessage
    finish_reason: Optional[str] = None


class ChatCompletionUsage(BaseModel):
    """OpenAI token usage."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """OpenAI chat completion response."""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: Optional[ChatCompletionUsage] = None
    system_fingerprint: Optional[str] = None


class ChatCompletionChunkChoice(BaseModel):
    """OpenAI streaming chunk choice."""
    index: int
    delta: dict
    finish_reason: Optional[str] = None


class ChatCompletionChunk(BaseModel):
    """OpenAI streaming chunk."""
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChatCompletionChunkChoice]
    system_fingerprint: Optional[str] = None


class ModelInfo(BaseModel):
    """OpenAI model info."""
    id: str
    object: str = "model"
    created: int
    owned_by: str = "ollama"


class ModelList(BaseModel):
    """OpenAI model list response."""
    object: str = "list"
    data: list[ModelInfo]


# ============================================================================
# Helper Functions
# ============================================================================

def convert_to_ollama_format(request: ChatCompletionRequest) -> dict:
    """Convert OpenAI request to Ollama format."""
    # Convert messages
    messages = []
    for msg in request.messages:
        m = {"role": msg.role, "content": msg.content or ""}
        if msg.role == "function":
            # Convert function response to assistant message
            m = {"role": "assistant", "content": f"Function {msg.name} returned: {msg.content}"}
        messages.append(m)

    # Build Ollama request
    ollama_request = {
        "model": request.model,
        "messages": messages,
        "stream": request.stream or False,
    }

    # Build options
    options = {}
    if request.temperature is not None:
        options["temperature"] = request.temperature
    if request.top_p is not None:
        options["top_p"] = request.top_p
    if request.max_tokens is not None:
        options["num_predict"] = request.max_tokens
    if request.presence_penalty is not None:
        options["presence_penalty"] = request.presence_penalty
    if request.frequency_penalty is not None:
        options["frequency_penalty"] = request.frequency_penalty
    if request.stop:
        options["stop"] = request.stop if isinstance(request.stop, list) else [request.stop]
    if request.seed is not None:
        options["seed"] = request.seed

    if options:
        ollama_request["options"] = options

    # Handle response format (JSON mode)
    if request.response_format and request.response_format.get("type") == "json_object":
        ollama_request["format"] = "json"

    # Handle tools/functions
    if request.tools:
        ollama_request["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": tool.function.name,
                    "description": tool.function.description or "",
                    "parameters": tool.function.parameters or {}
                }
            }
            for tool in request.tools
        ]
    elif request.functions:
        ollama_request["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": fn.name,
                    "description": fn.description or "",
                    "parameters": fn.parameters or {}
                }
            }
            for fn in request.functions
        ]

    return ollama_request


def convert_from_ollama_response(ollama_response: dict, model: str, request_id: str) -> ChatCompletionResponse:
    """Convert Ollama response to OpenAI format."""
    message = ollama_response.get("message", {})

    # Build response message
    response_message = ChatMessage(
        role=message.get("role", "assistant"),
        content=message.get("content", "")
    )

    # Handle tool calls if present
    tool_calls = message.get("tool_calls")
    if tool_calls:
        response_message.tool_calls = [
            {
                "id": f"call_{uuid.uuid4().hex[:8]}",
                "type": "function",
                "function": {
                    "name": tc["function"]["name"],
                    "arguments": json.dumps(tc["function"].get("arguments", {}))
                }
            }
            for tc in tool_calls
        ]
        response_message.content = None

    # Determine finish reason
    finish_reason = "stop"
    if tool_calls:
        finish_reason = "tool_calls"
    elif ollama_response.get("done_reason") == "length":
        finish_reason = "length"

    # Calculate token usage
    prompt_tokens = ollama_response.get("prompt_eval_count", 0)
    completion_tokens = ollama_response.get("eval_count", 0)

    return ChatCompletionResponse(
        id=request_id,
        created=int(time.time()),
        model=model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=response_message,
                finish_reason=finish_reason
            )
        ],
        usage=ChatCompletionUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens
        )
    )


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI-compatible chat completions endpoint.

    Supports both streaming and non-streaming responses.
    Compatible with OpenAI SDKs and tools.
    """
    request_id = f"chatcmpl-{uuid.uuid4().hex}"
    ollama_request = convert_to_ollama_format(request)

    if request.stream:
        async def stream_response():
            async with httpx.AsyncClient(timeout=None) as client:
                try:
                    async with client.stream(
                        "POST",
                        f"{OLLAMA_HOST}/api/chat",
                        json={**ollama_request, "stream": True}
                    ) as response:
                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            try:
                                chunk_data = json.loads(line)
                                message = chunk_data.get("message", {})
                                content = message.get("content", "")

                                # Build OpenAI-compatible chunk
                                chunk = ChatCompletionChunk(
                                    id=request_id,
                                    created=int(time.time()),
                                    model=request.model,
                                    choices=[
                                        ChatCompletionChunkChoice(
                                            index=0,
                                            delta={"content": content} if content else {},
                                            finish_reason="stop" if chunk_data.get("done") else None
                                        )
                                    ]
                                )
                                yield f"data: {chunk.model_dump_json()}\n\n"

                                if chunk_data.get("done"):
                                    yield "data: [DONE]\n\n"
                                    break
                            except json.JSONDecodeError:
                                continue
                except httpx.HTTPError as e:
                    error_chunk = {"error": {"message": str(e), "type": "api_error"}}
                    yield f"data: {json.dumps(error_chunk)}\n\n"

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Non-streaming response
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    f"{OLLAMA_HOST}/api/chat",
                    json={**ollama_request, "stream": False}
                )
                response.raise_for_status()
                ollama_response = response.json()
                return convert_from_ollama_response(ollama_response, request.model, request_id)
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"message": f"Ollama connection failed: {str(e)}", "type": "api_error"}}
                )


@router.get("/models")
async def list_models():
    """List available models in OpenAI format."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{OLLAMA_HOST}/api/tags")
            response.raise_for_status()
            data = response.json()

            models = []
            for model in data.get("models", []):
                # Parse model info
                name = model.get("name", "unknown")
                modified = model.get("modified_at", "")

                # Convert modified time to timestamp
                created = int(time.time())
                if modified:
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(modified.replace("Z", "+00:00"))
                        created = int(dt.timestamp())
                    except Exception:
                        pass

                models.append(ModelInfo(
                    id=name,
                    created=created,
                    owned_by="ollama"
                ))

            return ModelList(data=models)
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=503,
                detail={"error": {"message": f"Ollama connection failed: {str(e)}", "type": "api_error"}}
            )


@router.get("/models/{model_id}")
async def get_model(model_id: str):
    """Get a specific model's info."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/show",
                json={"name": model_id}
            )
            response.raise_for_status()
            data = response.json()

            return ModelInfo(
                id=model_id,
                created=int(time.time()),
                owned_by="ollama"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
            raise HTTPException(status_code=503, detail=f"Ollama error: {str(e)}")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")
