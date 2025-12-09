"""Tools debugging and testing endpoints."""

import json
from typing import Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ToolDefinition(BaseModel):
    """Tool/function definition for LLMs."""
    name: str
    description: str
    parameters: dict  # JSON Schema
    strict: bool = False


class ToolTestRequest(BaseModel):
    """Request to test tool calling with a model."""
    model: str
    prompt: str
    tools: list[ToolDefinition]


class ToolCallTrace(BaseModel):
    """Trace of a tool call."""
    id: str
    name: str
    arguments: dict
    result: Optional[Any] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None


# Built-in tool definitions for testing
EXAMPLE_TOOLS = [
    {
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and state, e.g., San Francisco, CA"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "default": "celsius"
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "search_web",
        "description": "Search the web for information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "num_results": {
                    "type": "integer",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "execute_code",
        "description": "Execute Python code in a sandbox",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code to execute"
                },
                "timeout": {
                    "type": "integer",
                    "default": 30
                }
            },
            "required": ["code"]
        }
    }
]


@router.get("/examples")
async def get_example_tools():
    """Get example tool definitions for testing."""
    return {"tools": EXAMPLE_TOOLS}


@router.post("/validate")
async def validate_tool_schema(tool: ToolDefinition):
    """Validate a tool's JSON Schema."""
    errors = []

    # Basic validation
    if not tool.name:
        errors.append("Tool name is required")

    if not tool.description:
        errors.append("Tool description is required")

    # Validate JSON Schema structure
    params = tool.parameters
    if params.get("type") != "object":
        errors.append("Parameters must have type 'object'")

    if "properties" not in params:
        errors.append("Parameters must have 'properties' field")

    if errors:
        return {"valid": False, "errors": errors}

    return {"valid": True, "schema": tool.model_dump()}


@router.post("/test")
async def test_tool_calling(request: ToolTestRequest):
    """Test tool calling with a model and return traces."""
    import os
    import httpx
    import time

    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

    # Convert tools to Ollama format
    ollama_tools = [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters
            }
        }
        for t in request.tools
    ]

    traces: list[ToolCallTrace] = []
    start_time = time.time()

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": request.model,
                    "messages": [{"role": "user", "content": request.prompt}],
                    "tools": ollama_tools,
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()

            # Extract tool calls from response
            message = data.get("message", {})
            tool_calls = message.get("tool_calls", [])

            for i, tc in enumerate(tool_calls):
                func = tc.get("function", {})
                traces.append(ToolCallTrace(
                    id=f"call_{i}",
                    name=func.get("name", "unknown"),
                    arguments=func.get("arguments", {}),
                    duration_ms=(time.time() - start_time) * 1000
                ))

            return {
                "model": request.model,
                "prompt": request.prompt,
                "response": message.get("content", ""),
                "tool_calls": traces,
                "raw_response": data
            }

        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Model error: {str(e)}")


@router.post("/compare")
async def compare_tool_calling(request: dict):
    """Compare tool calling across multiple models."""
    models = request.get("models", [])
    prompt = request.get("prompt", "")
    tools = request.get("tools", EXAMPLE_TOOLS)

    results = {}
    for model in models:
        test_request = ToolTestRequest(
            model=model,
            prompt=prompt,
            tools=[ToolDefinition(**t) for t in tools]
        )
        try:
            result = await test_tool_calling(test_request)
            results[model] = result
        except HTTPException as e:
            results[model] = {"error": str(e.detail)}

    return {"comparison": results}
