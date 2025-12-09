"""
Ollama Workbench 2.0 - FastAPI Backend
The Developer's Local LLM IDE
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import chat, ollama, health, agents, tools, mcp, prompts, openai_compat, knowledge, memory, projects, repos, model_tests, compare, planning


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("Starting Ollama Workbench API...")
    yield
    # Shutdown
    print("Shutting down Ollama Workbench API...")


app = FastAPI(
    title="Ollama Workbench API",
    description="The Developer's Local LLM IDE - Backend API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:1420", "tauri://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(ollama.router, prefix="/api/ollama", tags=["Ollama"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])
app.include_router(mcp.router, prefix="/api/mcp", tags=["MCP"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["Prompts"])
app.include_router(openai_compat.router, prefix="/v1", tags=["OpenAI Compatible"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge Base"])
app.include_router(memory.router, prefix="/api/memory", tags=["Episodic Memory"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(repos.router, prefix="/api/repos", tags=["Repository Analysis"])
app.include_router(model_tests.router, prefix="/api/model-tests", tags=["Model Tests"])
app.include_router(compare.router, prefix="/api/compare", tags=["Model Comparison"])
app.include_router(planning.router, prefix="/api/planning", tags=["AI Planning"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Ollama Workbench API",
        "version": "2.0.0",
        "description": "The Developer's Local LLM IDE",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
