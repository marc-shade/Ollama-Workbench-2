"""Ollama API proxy endpoints."""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


class PullRequest(BaseModel):
    name: str
    insecure: bool = False


class DeleteRequest(BaseModel):
    name: str


class GenerateRequest(BaseModel):
    model: str
    prompt: str
    system: Optional[str] = None
    template: Optional[str] = None
    context: Optional[list] = None
    stream: bool = True
    raw: bool = False
    format: Optional[str] = None
    options: Optional[dict] = None


@router.get("/tags")
async def list_models():
    """List available models from Ollama."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{OLLAMA_HOST}/api/tags")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.get("/show/{model_name}")
async def show_model(model_name: str):
    """Get model information."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/show",
                json={"name": model_name}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.post("/pull")
async def pull_model(request: PullRequest):
    """Pull a model from Ollama registry."""
    async def stream_pull():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/pull",
                json={"name": request.name, "insecure": request.insecure}
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream_pull(), media_type="application/x-ndjson")


@router.delete("/delete")
async def delete_model(request: DeleteRequest):
    """Delete a model."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.delete(
                f"{OLLAMA_HOST}/api/delete",
                json={"name": request.name}
            )
            response.raise_for_status()
            return {"status": "deleted", "model": request.name}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.post("/generate")
async def generate(request: GenerateRequest):
    """Generate completion (non-chat)."""
    async def stream_generate():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/generate",
                json=request.model_dump(exclude_none=True)
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    if request.stream:
        return StreamingResponse(stream_generate(), media_type="application/x-ndjson")
    else:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json=request.model_dump(exclude_none=True)
            )
            return response.json()


@router.get("/ps")
async def list_running():
    """List running models."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{OLLAMA_HOST}/api/ps")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.get("/version")
async def get_version():
    """Get Ollama server version."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{OLLAMA_HOST}/api/version")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Ollama connection failed: {str(e)}")


@router.get("/status")
async def get_status():
    """Get comprehensive Ollama server status for monitoring dashboard."""
    import time
    start_time = time.time()

    status = {
        "host": OLLAMA_HOST,
        "connected": False,
        "version": None,
        "running_models": [],
        "installed_models": [],
        "model_count": 0,
        "running_count": 0,
        "latency_ms": 0,
        "error": None
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Check connection and get version
        try:
            version_response = await client.get(f"{OLLAMA_HOST}/api/version")
            version_response.raise_for_status()
            status["connected"] = True
            status["version"] = version_response.json().get("version")
        except httpx.HTTPError as e:
            status["error"] = str(e)
            status["latency_ms"] = round((time.time() - start_time) * 1000)
            return status

        # Get installed models
        try:
            tags_response = await client.get(f"{OLLAMA_HOST}/api/tags")
            tags_response.raise_for_status()
            models = tags_response.json().get("models", [])
            status["installed_models"] = [
                {
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "modified_at": m.get("modified_at"),
                    "parameter_size": m.get("details", {}).get("parameter_size"),
                    "quantization": m.get("details", {}).get("quantization_level"),
                    "family": m.get("details", {}).get("family")
                }
                for m in models
            ]
            status["model_count"] = len(models)
        except httpx.HTTPError:
            pass

        # Get running models
        try:
            ps_response = await client.get(f"{OLLAMA_HOST}/api/ps")
            ps_response.raise_for_status()
            running = ps_response.json().get("models", [])
            status["running_models"] = [
                {
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "vram_size": m.get("size_vram"),
                    "expires_at": m.get("expires_at"),
                    "processor": m.get("details", {}).get("processor", "cpu")
                }
                for m in running
            ]
            status["running_count"] = len(running)
        except httpx.HTTPError:
            pass

    status["latency_ms"] = round((time.time() - start_time) * 1000)
    return status
