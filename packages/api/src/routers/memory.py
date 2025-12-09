"""Episodic Memory API.

Provides persistent memory for chat conversations, enabling:
- Session memory (short-term context within a conversation)
- Episodic memory (long-term storage of significant interactions)
- Memory retrieval for context injection
- Automatic memory summarization and consolidation

Memory Types:
- Session: Active conversation context (volatile)
- Episodic: Notable interactions and learnings (persistent)
- Semantic: Extracted concepts and facts (persistent)
"""

import os
import json
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Literal
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))


# ============================================================================
# Models
# ============================================================================

class MemoryEntry(BaseModel):
    """A memory entry."""
    id: str
    type: Literal["session", "episodic", "semantic"]
    content: str
    summary: Optional[str] = None
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    timestamp: str
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    metadata: dict = {}
    embedding: Optional[list[float]] = None


class Session(BaseModel):
    """A conversation session."""
    id: str
    agent_id: Optional[str] = None
    started_at: str
    last_active_at: str
    message_count: int = 0
    summary: Optional[str] = None
    metadata: dict = {}


class MemorySearchRequest(BaseModel):
    """Memory search request."""
    query: str
    types: Optional[list[str]] = None  # ["session", "episodic", "semantic"]
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)
    min_importance: float = Field(default=0.0, ge=0.0, le=1.0)
    time_range_hours: Optional[int] = None


class MemoryStoreRequest(BaseModel):
    """Store a memory entry."""
    content: str
    type: Literal["session", "episodic", "semantic"] = "episodic"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    metadata: dict = {}
    auto_summarize: bool = False


class ConsolidationRequest(BaseModel):
    """Memory consolidation request."""
    session_id: Optional[str] = None
    max_age_hours: int = Field(default=24, ge=1)
    importance_threshold: float = Field(default=0.3, ge=0.0, le=1.0)


# ============================================================================
# Storage (In-memory for demo, replace with SQLite/Qdrant for production)
# ============================================================================

_sessions: dict[str, Session] = {}
_memories: dict[str, MemoryEntry] = {}


def ensure_data_dir():
    """Ensure data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "memory").mkdir(exist_ok=True)


# ============================================================================
# Embedding & Summarization
# ============================================================================

async def generate_embedding(text: str, model: str = "nomic-embed-text") -> list[float]:
    """Generate embedding for text."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/embed",
                json={"model": model, "input": text}
            )
            response.raise_for_status()
            data = response.json()
            embeddings = data.get("embeddings", [[]])
            return embeddings[0] if embeddings else []
        except httpx.HTTPError:
            return []


async def summarize_text(text: str, model: str = "llama3.2") -> str:
    """Generate a summary of text."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant. Summarize the following text concisely, capturing the key points and any important learnings."},
                        {"role": "user", "content": text}
                    ],
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")
        except httpx.HTTPError:
            return ""


# ============================================================================
# Session Management
# ============================================================================

@router.post("/sessions")
async def create_session(agent_id: Optional[str] = None, metadata: dict = {}) -> Session:
    """Create a new conversation session."""
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    now = datetime.now().isoformat()

    session = Session(
        id=session_id,
        agent_id=agent_id,
        started_at=now,
        last_active_at=now,
        metadata=metadata
    )

    _sessions[session_id] = session
    return session


@router.get("/sessions")
async def list_sessions(
    agent_id: Optional[str] = None,
    active_within_hours: Optional[int] = None
) -> list[Session]:
    """List sessions, optionally filtered."""
    sessions = list(_sessions.values())

    if agent_id:
        sessions = [s for s in sessions if s.agent_id == agent_id]

    if active_within_hours:
        cutoff = datetime.now() - timedelta(hours=active_within_hours)
        sessions = [
            s for s in sessions
            if datetime.fromisoformat(s.last_active_at) > cutoff
        ]

    return sorted(sessions, key=lambda s: s.last_active_at, reverse=True)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> Session:
    """Get session details."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return _sessions[session_id]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its memories."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete associated session memories
    memory_ids = [
        mid for mid, m in _memories.items()
        if m.session_id == session_id and m.type == "session"
    ]
    for mid in memory_ids:
        del _memories[mid]

    del _sessions[session_id]
    return {"status": "deleted", "memories_deleted": len(memory_ids)}


# ============================================================================
# Memory Operations
# ============================================================================

@router.post("/store")
async def store_memory(request: MemoryStoreRequest) -> MemoryEntry:
    """Store a memory entry."""
    memory_id = f"mem_{uuid.uuid4().hex[:12]}"
    now = datetime.now().isoformat()

    # Generate embedding
    embedding = await generate_embedding(request.content)

    # Generate summary if requested
    summary = None
    if request.auto_summarize and len(request.content) > 500:
        summary = await summarize_text(request.content)

    memory = MemoryEntry(
        id=memory_id,
        type=request.type,
        content=request.content,
        summary=summary,
        importance=request.importance,
        timestamp=now,
        session_id=request.session_id,
        agent_id=request.agent_id,
        metadata=request.metadata,
        embedding=embedding if embedding else None
    )

    _memories[memory_id] = memory

    # Update session if applicable
    if request.session_id and request.session_id in _sessions:
        session = _sessions[request.session_id]
        session.message_count += 1
        session.last_active_at = now

    return memory


@router.post("/search")
async def search_memories(request: MemorySearchRequest) -> list[MemoryEntry]:
    """Search memories using semantic similarity."""
    # Generate query embedding
    query_embedding = await generate_embedding(request.query)

    if not query_embedding:
        # Fallback to keyword search
        return keyword_search(request)

    # Semantic search
    results = []
    import numpy as np

    for memory in _memories.values():
        # Apply filters
        if request.types and memory.type not in request.types:
            continue
        if request.session_id and memory.session_id != request.session_id:
            continue
        if request.agent_id and memory.agent_id != request.agent_id:
            continue
        if memory.importance < request.min_importance:
            continue
        if request.time_range_hours:
            memory_time = datetime.fromisoformat(memory.timestamp)
            cutoff = datetime.now() - timedelta(hours=request.time_range_hours)
            if memory_time < cutoff:
                continue

        # Calculate similarity
        if memory.embedding:
            a = np.array(query_embedding)
            b = np.array(memory.embedding)
            score = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
            results.append((memory, score))

    # Sort by similarity and importance
    results.sort(key=lambda x: x[1] * (0.7 + 0.3 * x[0].importance), reverse=True)

    return [r[0] for r in results[:request.limit]]


def keyword_search(request: MemorySearchRequest) -> list[MemoryEntry]:
    """Fallback keyword search."""
    keywords = request.query.lower().split()
    results = []

    for memory in _memories.values():
        # Apply filters
        if request.types and memory.type not in request.types:
            continue
        if request.session_id and memory.session_id != request.session_id:
            continue
        if request.agent_id and memory.agent_id != request.agent_id:
            continue
        if memory.importance < request.min_importance:
            continue

        # Simple keyword matching
        content_lower = memory.content.lower()
        matches = sum(1 for kw in keywords if kw in content_lower)
        if matches > 0:
            results.append((memory, matches))

    results.sort(key=lambda x: x[1] * x[0].importance, reverse=True)
    return [r[0] for r in results[:request.limit]]


@router.get("/memories/{memory_id}")
async def get_memory(memory_id: str) -> MemoryEntry:
    """Get a specific memory entry."""
    if memory_id not in _memories:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _memories[memory_id]


@router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a memory entry."""
    if memory_id not in _memories:
        raise HTTPException(status_code=404, detail="Memory not found")
    del _memories[memory_id]
    return {"status": "deleted"}


@router.patch("/memories/{memory_id}/importance")
async def update_importance(memory_id: str, importance: float):
    """Update memory importance score."""
    if memory_id not in _memories:
        raise HTTPException(status_code=404, detail="Memory not found")
    if not 0.0 <= importance <= 1.0:
        raise HTTPException(status_code=400, detail="Importance must be between 0 and 1")

    _memories[memory_id].importance = importance
    return _memories[memory_id]


# ============================================================================
# Memory Consolidation
# ============================================================================

@router.post("/consolidate")
async def consolidate_memories(request: ConsolidationRequest):
    """Consolidate session memories into episodic memories.

    This process:
    1. Finds session memories older than max_age_hours
    2. Filters by importance threshold
    3. Summarizes and promotes important ones to episodic
    4. Deletes low-importance session memories
    """
    now = datetime.now()
    cutoff = now - timedelta(hours=request.max_age_hours)

    # Find candidate memories
    candidates = []
    for memory in _memories.values():
        if memory.type != "session":
            continue
        if request.session_id and memory.session_id != request.session_id:
            continue

        memory_time = datetime.fromisoformat(memory.timestamp)
        if memory_time < cutoff:
            candidates.append(memory)

    promoted = 0
    deleted = 0

    for memory in candidates:
        if memory.importance >= request.importance_threshold:
            # Promote to episodic
            summary = memory.summary or await summarize_text(memory.content)
            new_memory = MemoryEntry(
                id=f"mem_{uuid.uuid4().hex[:12]}",
                type="episodic",
                content=memory.content,
                summary=summary,
                importance=memory.importance,
                timestamp=memory.timestamp,
                session_id=memory.session_id,
                agent_id=memory.agent_id,
                metadata={**memory.metadata, "promoted_from": memory.id},
                embedding=memory.embedding
            )
            _memories[new_memory.id] = new_memory
            promoted += 1

        # Delete original session memory
        del _memories[memory.id]
        deleted += 1

    return {
        "candidates_found": len(candidates),
        "promoted_to_episodic": promoted,
        "deleted": deleted
    }


@router.post("/summarize-session/{session_id}")
async def summarize_session(session_id: str):
    """Generate a summary of a session's memories."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all session memories
    session_memories = [
        m for m in _memories.values()
        if m.session_id == session_id
    ]

    if not session_memories:
        return {"summary": "No memories in session"}

    # Sort by timestamp
    session_memories.sort(key=lambda m: m.timestamp)

    # Combine content
    combined = "\n\n".join([
        f"[{m.type.upper()}] {m.content}"
        for m in session_memories
    ])

    # Generate summary
    summary = await summarize_text(combined)

    # Update session
    _sessions[session_id].summary = summary

    return {"session_id": session_id, "summary": summary, "memory_count": len(session_memories)}


# ============================================================================
# Context Building
# ============================================================================

@router.post("/context")
async def build_context(
    query: str,
    session_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    max_tokens: int = 2048,
    include_episodic: bool = True,
    include_semantic: bool = True
):
    """Build context for chat injection from relevant memories.

    Returns formatted context text suitable for injection into
    system prompts or conversation history.
    """
    types = []
    if session_id:
        types.append("session")
    if include_episodic:
        types.append("episodic")
    if include_semantic:
        types.append("semantic")

    # Search for relevant memories
    results = await search_memories(MemorySearchRequest(
        query=query,
        types=types,
        session_id=session_id,
        agent_id=agent_id,
        limit=20,
        min_importance=0.3
    ))

    # Build context
    context_parts = []
    total_chars = 0
    max_chars = max_tokens * 4

    for memory in results:
        # Use summary if available, otherwise content
        text = memory.summary or memory.content
        if total_chars + len(text) > max_chars:
            break

        label = f"[{memory.type.upper()}]"
        context_parts.append(f"{label} {text}")
        total_chars += len(text)

    context_text = "\n\n".join(context_parts)

    return {
        "context": context_text,
        "memory_count": len(context_parts),
        "total_tokens": total_chars // 4,
        "memory_ids": [m.id for m in results[:len(context_parts)]]
    }


# ============================================================================
# Statistics
# ============================================================================

@router.get("/stats")
async def get_memory_stats():
    """Get memory system statistics."""
    type_counts = {"session": 0, "episodic": 0, "semantic": 0}
    for memory in _memories.values():
        type_counts[memory.type] += 1

    return {
        "total_memories": len(_memories),
        "by_type": type_counts,
        "total_sessions": len(_sessions),
        "active_sessions": len([
            s for s in _sessions.values()
            if datetime.fromisoformat(s.last_active_at) > datetime.now() - timedelta(hours=24)
        ])
    }
