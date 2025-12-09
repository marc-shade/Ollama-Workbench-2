"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
async def health_check():
    """Check API health status."""
    return {
        "status": "healthy",
        "service": "ollama-workbench-api",
        "version": "2.0.0",
    }


@router.get("/api/ready")
async def readiness_check():
    """Check if API is ready to serve requests."""
    return {"ready": True}
