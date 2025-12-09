"""Vision and Model Comparison API endpoints."""

import asyncio
import base64
import json
import os
import time
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DATA_DIR = os.getenv("DATA_DIR", "./data")
COMPARISONS_DIR = os.path.join(DATA_DIR, "comparisons")


class ModelResponse(BaseModel):
    model: str
    response: str
    latency_ms: float
    tokens: int = 0
    error: Optional[str] = None


class VisionComparison(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    prompt: str
    models: List[str]
    responses: List[ModelResponse] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class TextComparison(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prompt: str
    system_prompt: Optional[str] = None
    models: List[str]
    responses: List[ModelResponse] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class CompareTextRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    models: List[str]
    temperature: float = 0.7
    max_tokens: int = 1024


class CompareVisionRequest(BaseModel):
    prompt: str = "Describe this image in detail."
    models: List[str]
    image_base64: Optional[str] = None
    image_url: Optional[str] = None


async def generate_response(
    model: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    images: Optional[List[str]] = None,
    temperature: float = 0.7,
    max_tokens: int = 1024
) -> ModelResponse:
    """Generate a response from a model."""
    start = time.time()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            if images:
                # Vision request
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "images": images,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
                response = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
            else:
                # Chat request
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                payload = {
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
                response = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)

            latency = (time.time() - start) * 1000

            if response.status_code == 200:
                data = response.json()

                if images:
                    return ModelResponse(
                        model=model,
                        response=data.get("response", ""),
                        latency_ms=latency,
                        tokens=data.get("eval_count", 0)
                    )
                else:
                    return ModelResponse(
                        model=model,
                        response=data.get("message", {}).get("content", ""),
                        latency_ms=latency,
                        tokens=data.get("eval_count", 0)
                    )
            else:
                return ModelResponse(
                    model=model,
                    response="",
                    latency_ms=latency,
                    error=f"API error: {response.status_code} - {response.text[:200]}"
                )

    except Exception as e:
        return ModelResponse(
            model=model,
            response="",
            latency_ms=(time.time() - start) * 1000,
            error=str(e)
        )


@router.post("/text")
async def compare_text(request: CompareTextRequest) -> TextComparison:
    """Compare text responses from multiple models."""
    if len(request.models) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 models for comparison")

    comparison = TextComparison(
        prompt=request.prompt,
        system_prompt=request.system_prompt,
        models=request.models
    )

    # Run all models concurrently
    tasks = [
        generate_response(
            model=model,
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        for model in request.models
    ]

    responses = await asyncio.gather(*tasks)
    comparison.responses = list(responses)

    return comparison


@router.post("/vision")
async def compare_vision(request: CompareVisionRequest) -> VisionComparison:
    """Compare vision model responses."""
    if len(request.models) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 models for comparison")

    if not request.image_base64 and not request.image_url:
        raise HTTPException(status_code=400, detail="Either image_base64 or image_url is required")

    images = []
    if request.image_base64:
        images = [request.image_base64]
    elif request.image_url:
        # Fetch image from URL
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(request.image_url)
                if response.status_code == 200:
                    images = [base64.b64encode(response.content).decode()]
                else:
                    raise HTTPException(status_code=400, detail="Failed to fetch image from URL")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

    comparison = VisionComparison(
        prompt=request.prompt,
        image_url=request.image_url,
        models=request.models
    )

    # Run all models concurrently
    tasks = [
        generate_response(
            model=model,
            prompt=request.prompt,
            images=images
        )
        for model in request.models
    ]

    responses = await asyncio.gather(*tasks)
    comparison.responses = list(responses)

    return comparison


@router.post("/vision/upload")
async def compare_vision_upload(
    file: UploadFile = File(...),
    prompt: str = Form(default="Describe this image in detail."),
    models: str = Form(...)  # Comma-separated list
) -> VisionComparison:
    """Compare vision models with uploaded image."""
    model_list = [m.strip() for m in models.split(",")]

    if len(model_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 models for comparison")

    # Read and encode image
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    # Save image for reference
    os.makedirs(COMPARISONS_DIR, exist_ok=True)
    image_id = str(uuid.uuid4())
    image_path = os.path.join(COMPARISONS_DIR, f"{image_id}_{file.filename}")

    with open(image_path, "wb") as f:
        f.write(content)

    comparison = VisionComparison(
        prompt=prompt,
        image_path=image_path,
        models=model_list
    )

    # Run all models concurrently
    tasks = [
        generate_response(
            model=model,
            prompt=prompt,
            images=[image_base64]
        )
        for model in model_list
    ]

    responses = await asyncio.gather(*tasks)
    comparison.responses = list(responses)

    return comparison


@router.get("/vision/models")
async def list_vision_models() -> List[dict]:
    """List available vision-capable models."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_HOST}/api/tags")

            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])

                # Filter for likely vision models
                vision_models = []
                vision_keywords = ["vision", "llava", "bakllava", "moondream", "llama3.2-vision", "minicpm-v"]

                for model in models:
                    name = model.get("name", "").lower()
                    if any(kw in name for kw in vision_keywords):
                        vision_models.append({
                            "name": model.get("name"),
                            "size": model.get("size"),
                            "modified": model.get("modified_at")
                        })

                return vision_models
            else:
                return []

    except Exception:
        return []


@router.post("/benchmark")
async def benchmark_models(
    prompt: str,
    models: List[str],
    runs: int = 3,
    temperature: float = 0.7
):
    """Benchmark multiple models with the same prompt."""
    if len(models) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 models")
    if runs > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 runs")

    results = {}

    for model in models:
        model_results = {
            "latencies": [],
            "tokens": [],
            "responses": []
        }

        for _ in range(runs):
            response = await generate_response(
                model=model,
                prompt=prompt,
                temperature=temperature
            )

            if not response.error:
                model_results["latencies"].append(response.latency_ms)
                model_results["tokens"].append(response.tokens)
                model_results["responses"].append(response.response[:200])

        if model_results["latencies"]:
            model_results["avg_latency_ms"] = sum(model_results["latencies"]) / len(model_results["latencies"])
            model_results["min_latency_ms"] = min(model_results["latencies"])
            model_results["max_latency_ms"] = max(model_results["latencies"])
            model_results["avg_tokens"] = sum(model_results["tokens"]) / len(model_results["tokens"])

        results[model] = model_results

    return {
        "prompt": prompt,
        "runs": runs,
        "results": results
    }
