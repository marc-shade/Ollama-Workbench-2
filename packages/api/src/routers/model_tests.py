"""Model Feature Tests API - Capability detection for LLM models."""

import asyncio
import base64
import json
import os
import time
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


class TestResult(BaseModel):
    test_name: str
    model: str
    passed: bool
    score: float = 0.0  # 0-1 score
    latency_ms: float = 0.0
    details: dict = Field(default_factory=dict)
    error: Optional[str] = None


class ModelCapabilities(BaseModel):
    model: str
    vision: Optional[TestResult] = None
    json_mode: Optional[TestResult] = None
    tool_calling: Optional[TestResult] = None
    context_window: Optional[TestResult] = None
    streaming: Optional[TestResult] = None
    system_prompt: Optional[TestResult] = None
    tested_at: str = ""


class RunTestRequest(BaseModel):
    model: str
    tests: List[Literal["vision", "json_mode", "tool_calling", "context_window", "streaming", "system_prompt"]] = Field(
        default_factory=lambda: ["json_mode", "tool_calling", "streaming", "system_prompt"]
    )


class ContextTestRequest(BaseModel):
    model: str
    test_positions: List[int] = Field(default_factory=lambda: [0, 25, 50, 75, 100])  # Percentage positions
    fact_count: int = 5


async def test_vision(model: str) -> TestResult:
    """Test if model supports vision/image input."""
    start = time.time()

    # Create a simple 1x1 red pixel PNG
    red_pixel = base64.b64encode(
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x05\xfe\xd4\x00\x00\x00\x00IEND\xaeB`\x82'
    ).decode()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": model,
                    "prompt": "What color is this image? Reply with just the color name.",
                    "images": [red_pixel],
                    "stream": False
                }
            )

            latency = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                answer = data.get("response", "").lower()
                passed = "red" in answer or "pixel" in answer

                return TestResult(
                    test_name="vision",
                    model=model,
                    passed=passed,
                    score=1.0 if passed else 0.0,
                    latency_ms=latency,
                    details={"response": data.get("response", "")[:200]}
                )
            else:
                # Check if it's a "model doesn't support images" error
                error_text = response.text
                if "does not support" in error_text.lower() or "image" in error_text.lower():
                    return TestResult(
                        test_name="vision",
                        model=model,
                        passed=False,
                        score=0.0,
                        latency_ms=latency,
                        details={"reason": "Model does not support vision"}
                    )
                raise Exception(f"API error: {response.status_code}")

    except Exception as e:
        return TestResult(
            test_name="vision",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


async def test_json_mode(model: str) -> TestResult:
    """Test if model can output valid JSON."""
    start = time.time()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": model,
                    "prompt": "Return a JSON object with keys 'name' (string) and 'age' (number). Only output valid JSON, nothing else.",
                    "format": "json",
                    "stream": False
                }
            )

            latency = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                output = data.get("response", "")

                # Try to parse as JSON
                try:
                    parsed = json.loads(output)
                    has_name = "name" in parsed and isinstance(parsed["name"], str)
                    has_age = "age" in parsed and isinstance(parsed["age"], (int, float))

                    score = 0.0
                    if has_name:
                        score += 0.5
                    if has_age:
                        score += 0.5

                    return TestResult(
                        test_name="json_mode",
                        model=model,
                        passed=score >= 0.5,
                        score=score,
                        latency_ms=latency,
                        details={"output": parsed, "valid_json": True}
                    )
                except json.JSONDecodeError:
                    return TestResult(
                        test_name="json_mode",
                        model=model,
                        passed=False,
                        score=0.0,
                        latency_ms=latency,
                        details={"output": output[:200], "valid_json": False}
                    )
            else:
                raise Exception(f"API error: {response.status_code}")

    except Exception as e:
        return TestResult(
            test_name="json_mode",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


async def test_tool_calling(model: str) -> TestResult:
    """Test if model supports function/tool calling."""
    start = time.time()

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name"
                        }
                    },
                    "required": ["location"]
                }
            }
        }
    ]

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": "What's the weather in Paris?"}
                    ],
                    "tools": tools,
                    "stream": False
                }
            )

            latency = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                message = data.get("message", {})
                tool_calls = message.get("tool_calls", [])

                if tool_calls:
                    # Check if it called the right function
                    first_call = tool_calls[0]
                    func_name = first_call.get("function", {}).get("name", "")
                    args = first_call.get("function", {}).get("arguments", {})

                    passed = func_name == "get_weather"
                    has_location = "location" in args if isinstance(args, dict) else False

                    score = 0.0
                    if passed:
                        score += 0.5
                    if has_location:
                        score += 0.5

                    return TestResult(
                        test_name="tool_calling",
                        model=model,
                        passed=passed,
                        score=score,
                        latency_ms=latency,
                        details={
                            "tool_calls": tool_calls,
                            "called_correct_function": passed,
                            "has_location_arg": has_location
                        }
                    )
                else:
                    # No tool calls - check if model responded with text instead
                    content = message.get("content", "")
                    return TestResult(
                        test_name="tool_calling",
                        model=model,
                        passed=False,
                        score=0.0,
                        latency_ms=latency,
                        details={
                            "reason": "No tool calls made",
                            "response": content[:200] if content else None
                        }
                    )
            else:
                raise Exception(f"API error: {response.status_code}")

    except Exception as e:
        return TestResult(
            test_name="tool_calling",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


async def test_streaming(model: str) -> TestResult:
    """Test if model supports streaming responses."""
    start = time.time()
    chunks_received = 0
    total_content = ""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": model,
                    "prompt": "Count from 1 to 5.",
                    "stream": True
                }
            ) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                if "response" in data:
                                    chunks_received += 1
                                    total_content += data["response"]
                            except json.JSONDecodeError:
                                pass
                else:
                    raise Exception(f"API error: {response.status_code}")

        latency = (time.time() - start) * 1000

        # Consider streaming working if we got multiple chunks
        passed = chunks_received > 1

        return TestResult(
            test_name="streaming",
            model=model,
            passed=passed,
            score=1.0 if passed else 0.0,
            latency_ms=latency,
            details={
                "chunks_received": chunks_received,
                "total_length": len(total_content)
            }
        )

    except Exception as e:
        return TestResult(
            test_name="streaming",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


async def test_system_prompt(model: str) -> TestResult:
    """Test if model follows system prompts."""
    start = time.time()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a pirate. Always respond in pirate speak and include 'Arrr!' in every response."},
                        {"role": "user", "content": "Hello, how are you today?"}
                    ],
                    "stream": False
                }
            )

            latency = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()
                content = data.get("message", {}).get("content", "").lower()

                # Check for pirate-like response
                has_arrr = "arrr" in content or "arr" in content
                has_pirate_words = any(word in content for word in ["matey", "ye", "ahoy", "treasure", "ship", "sea", "captain"])

                score = 0.0
                if has_arrr:
                    score += 0.6
                if has_pirate_words:
                    score += 0.4

                return TestResult(
                    test_name="system_prompt",
                    model=model,
                    passed=score >= 0.5,
                    score=score,
                    latency_ms=latency,
                    details={
                        "response": data.get("message", {}).get("content", "")[:300],
                        "has_arrr": has_arrr,
                        "has_pirate_words": has_pirate_words
                    }
                )
            else:
                raise Exception(f"API error: {response.status_code}")

    except Exception as e:
        return TestResult(
            test_name="system_prompt",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


async def test_context_window(model: str, positions: List[int] = [0, 25, 50, 75, 100]) -> TestResult:
    """Test context window retrieval at various positions."""
    start = time.time()

    # Create a context with facts at different positions
    filler = "The sky is blue. Water is wet. Fire is hot. " * 50  # ~600 tokens per repeat
    facts = [
        ("The secret code is ALPHA123.", "What is the secret code?", "ALPHA123"),
        ("The hidden word is BETA456.", "What is the hidden word?", "BETA456"),
        ("The magic number is GAMMA789.", "What is the magic number?", "GAMMA789"),
    ]

    results_by_position = {}
    total_score = 0.0

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for pos in positions:
                # Build context with fact at specified position
                fact, question, answer = facts[pos % len(facts)]

                if pos == 0:
                    context = fact + " " + filler
                elif pos == 100:
                    context = filler + " " + fact
                else:
                    # Split filler at position
                    split_point = int(len(filler) * pos / 100)
                    context = filler[:split_point] + " " + fact + " " + filler[split_point:]

                response = await client.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": model,
                        "prompt": f"Context: {context}\n\nQuestion: {question}\n\nAnswer with just the value, nothing else:",
                        "stream": False
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    output = data.get("response", "").strip()
                    found = answer.lower() in output.lower()

                    results_by_position[f"{pos}%"] = {
                        "found": found,
                        "response": output[:100]
                    }

                    if found:
                        total_score += 1.0 / len(positions)
                else:
                    results_by_position[f"{pos}%"] = {
                        "found": False,
                        "error": f"API error: {response.status_code}"
                    }

        latency = (time.time() - start) * 1000

        return TestResult(
            test_name="context_window",
            model=model,
            passed=total_score >= 0.5,
            score=total_score,
            latency_ms=latency,
            details={
                "positions_tested": positions,
                "results": results_by_position
            }
        )

    except Exception as e:
        return TestResult(
            test_name="context_window",
            model=model,
            passed=False,
            score=0.0,
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


@router.post("/run")
async def run_tests(request: RunTestRequest) -> ModelCapabilities:
    """Run capability tests on a model."""
    from datetime import datetime

    capabilities = ModelCapabilities(
        model=request.model,
        tested_at=datetime.utcnow().isoformat()
    )

    test_map = {
        "vision": test_vision,
        "json_mode": test_json_mode,
        "tool_calling": test_tool_calling,
        "streaming": test_streaming,
        "system_prompt": test_system_prompt,
        "context_window": test_context_window
    }

    # Run tests concurrently
    tasks = []
    for test_name in request.tests:
        if test_name in test_map:
            tasks.append((test_name, test_map[test_name](request.model)))

    results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)

    for (test_name, _), result in zip(tasks, results):
        if isinstance(result, Exception):
            setattr(capabilities, test_name, TestResult(
                test_name=test_name,
                model=request.model,
                passed=False,
                error=str(result)
            ))
        else:
            setattr(capabilities, test_name, result)

    return capabilities


@router.post("/context")
async def run_context_test(request: ContextTestRequest) -> TestResult:
    """Run detailed context window test."""
    return await test_context_window(request.model, request.test_positions)


@router.get("/compare")
async def compare_models(models: str, tests: str = "json_mode,tool_calling,streaming,system_prompt"):
    """Compare multiple models' capabilities."""
    model_list = [m.strip() for m in models.split(",")]
    test_list = [t.strip() for t in tests.split(",")]

    if len(model_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 models for comparison")

    results = {}

    for model in model_list:
        request = RunTestRequest(model=model, tests=test_list)
        results[model] = await run_tests(request)

    return results
