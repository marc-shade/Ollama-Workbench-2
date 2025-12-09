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
