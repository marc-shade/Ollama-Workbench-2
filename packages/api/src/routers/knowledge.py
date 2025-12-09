"""Knowledge Base and RAG Pipeline API.

Provides document management, embedding generation, and semantic search
for Retrieval-Augmented Generation (RAG) integration with chat.

Features:
- Document upload and chunking
- Embedding generation via Ollama
- Semantic search with relevance scoring
- RAG context injection for chat
"""

import os
import json
import uuid
import hashlib
from datetime import datetime
from typing import Optional, Literal
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_URL = f"http://{QDRANT_HOST}:{QDRANT_PORT}"
DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))


# ============================================================================
# Models
# ============================================================================

class ChunkingStrategy(BaseModel):
    """Document chunking configuration."""
    method: Literal["fixed", "sentence", "paragraph", "semantic"] = "paragraph"
    chunk_size: int = Field(default=512, ge=100, le=4096)
    chunk_overlap: int = Field(default=50, ge=0, le=256)


class Document(BaseModel):
    """Document metadata."""
    id: str
    collection_id: str
    filename: str
    content_type: str
    size_bytes: int
    chunk_count: int
    created_at: str
    metadata: dict = {}


class Collection(BaseModel):
    """Document collection."""
    id: str
    name: str
    description: str = ""
    embedding_model: str = "nomic-embed-text"
    document_count: int = 0
    chunk_count: int = 0
    created_at: str
    updated_at: str


class SearchResult(BaseModel):
    """Semantic search result."""
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: dict = {}


class RAGContext(BaseModel):
    """RAG context for chat injection."""
    query: str
    results: list[SearchResult]
    total_tokens: int
    context_text: str


class EmbeddingRequest(BaseModel):
    """Embedding generation request."""
    text: str | list[str]
    model: str = "nomic-embed-text"


class SearchRequest(BaseModel):
    """Semantic search request."""
    query: str
    collection_id: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=50)
    score_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class RAGRequest(BaseModel):
    """RAG context request."""
    query: str
    collection_id: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)
    max_tokens: int = Field(default=2048, ge=256, le=8192)
    include_sources: bool = True


# ============================================================================
# Storage (SQLite for metadata, in-memory for demo)
# ============================================================================

# In-memory storage for demo (replace with SQLite in production)
_collections: dict[str, Collection] = {}
_documents: dict[str, Document] = {}
_chunks: dict[str, dict] = {}  # chunk_id -> {content, document_id, collection_id, embedding}


def ensure_data_dir():
    """Ensure data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "documents").mkdir(exist_ok=True)


# ============================================================================
# Text Chunking
# ============================================================================

def chunk_text(text: str, strategy: ChunkingStrategy) -> list[str]:
    """Split text into chunks based on strategy."""
    if strategy.method == "fixed":
        return chunk_fixed(text, strategy.chunk_size, strategy.chunk_overlap)
    elif strategy.method == "sentence":
        return chunk_sentences(text, strategy.chunk_size, strategy.chunk_overlap)
    elif strategy.method == "paragraph":
        return chunk_paragraphs(text, strategy.chunk_size, strategy.chunk_overlap)
    else:
        # Default to paragraph
        return chunk_paragraphs(text, strategy.chunk_size, strategy.chunk_overlap)


def chunk_fixed(text: str, size: int, overlap: int) -> list[str]:
    """Fixed-size character chunking."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
    return chunks


def chunk_sentences(text: str, max_size: int, overlap: int) -> list[str]:
    """Sentence-based chunking."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= max_size:
            current_chunk += " " + sentence if current_chunk else sentence
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def chunk_paragraphs(text: str, max_size: int, overlap: int) -> list[str]:
    """Paragraph-based chunking."""
    paragraphs = text.split("\n\n")

    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) <= max_size:
            current_chunk += "\n\n" + para if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # If paragraph itself is too long, split it
            if len(para) > max_size:
                sub_chunks = chunk_fixed(para, max_size, overlap)
                chunks.extend(sub_chunks)
                current_chunk = ""
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


# ============================================================================
# Embedding Generation
# ============================================================================

async def generate_embedding(text: str | list[str], model: str = "nomic-embed-text") -> list[list[float]]:
    """Generate embeddings using Ollama."""
    texts = [text] if isinstance(text, str) else text

    embeddings = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for t in texts:
            try:
                response = await client.post(
                    f"{OLLAMA_HOST}/api/embed",
                    json={"model": model, "input": t}
                )
                response.raise_for_status()
                data = response.json()
                embeddings.append(data.get("embeddings", [[]])[0])
            except httpx.HTTPError as e:
                raise HTTPException(status_code=503, detail=f"Embedding generation failed: {str(e)}")

    return embeddings


# ============================================================================
# Vector Store (Qdrant)
# ============================================================================

async def ensure_collection_exists(collection_id: str, vector_size: int = 768):
    """Ensure Qdrant collection exists."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Check if collection exists
            response = await client.get(f"{QDRANT_URL}/collections/{collection_id}")
            if response.status_code == 200:
                return True

            # Create collection
            response = await client.put(
                f"{QDRANT_URL}/collections/{collection_id}",
                json={
                    "vectors": {
                        "size": vector_size,
                        "distance": "Cosine"
                    }
                }
            )
            return response.status_code in (200, 201)
        except httpx.HTTPError:
            # Qdrant not available, use in-memory fallback
            return False


async def store_vectors(collection_id: str, points: list[dict]):
    """Store vectors in Qdrant."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.put(
                f"{QDRANT_URL}/collections/{collection_id}/points",
                json={"points": points}
            )
            return response.status_code in (200, 201)
        except httpx.HTTPError:
            return False


async def search_vectors(collection_id: str, query_vector: list[float], limit: int = 5, score_threshold: float = 0.5) -> list[dict]:
    """Search vectors in Qdrant."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{QDRANT_URL}/collections/{collection_id}/points/search",
                json={
                    "vector": query_vector,
                    "limit": limit,
                    "with_payload": True,
                    "score_threshold": score_threshold
                }
            )
            if response.status_code == 200:
                return response.json().get("result", [])
        except httpx.HTTPError:
            pass
    return []


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/collections")
async def create_collection(
    name: str,
    description: str = "",
    embedding_model: str = "nomic-embed-text"
) -> Collection:
    """Create a new document collection."""
    collection_id = f"col_{uuid.uuid4().hex[:12]}"
    now = datetime.now().isoformat()

    collection = Collection(
        id=collection_id,
        name=name,
        description=description,
        embedding_model=embedding_model,
        created_at=now,
        updated_at=now
    )

    # Create Qdrant collection
    await ensure_collection_exists(collection_id)

    _collections[collection_id] = collection
    return collection


@router.get("/collections")
async def list_collections() -> list[Collection]:
    """List all collections."""
    return list(_collections.values())


@router.get("/collections/{collection_id}")
async def get_collection(collection_id: str) -> Collection:
    """Get collection details."""
    if collection_id not in _collections:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _collections[collection_id]


@router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: str):
    """Delete a collection and all its documents."""
    if collection_id not in _collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Delete from Qdrant
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            await client.delete(f"{QDRANT_URL}/collections/{collection_id}")
        except httpx.HTTPError:
            pass

    # Delete documents and chunks
    doc_ids = [d.id for d in _documents.values() if d.collection_id == collection_id]
    for doc_id in doc_ids:
        del _documents[doc_id]

    chunk_ids = [cid for cid, c in _chunks.items() if c["collection_id"] == collection_id]
    for chunk_id in chunk_ids:
        del _chunks[chunk_id]

    del _collections[collection_id]
    return {"status": "deleted"}


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    collection_id: str = Form(...),
    chunking_method: str = Form("paragraph"),
    chunk_size: int = Form(512),
    chunk_overlap: int = Form(50)
) -> Document:
    """Upload and process a document."""
    if collection_id not in _collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    collection = _collections[collection_id]
    ensure_data_dir()

    # Read file content
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    # Create document
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    now = datetime.now().isoformat()

    # Chunk the document
    strategy = ChunkingStrategy(
        method=chunking_method,  # type: ignore
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    chunks = chunk_text(text, strategy)

    # Generate embeddings
    embeddings = await generate_embedding(chunks, collection.embedding_model)

    # Store chunks with embeddings
    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_id = f"chunk_{doc_id}_{i}"
        _chunks[chunk_id] = {
            "content": chunk,
            "document_id": doc_id,
            "collection_id": collection_id,
            "embedding": embedding,
            "metadata": {"filename": file.filename, "chunk_index": i}
        }

        # Prepare for Qdrant
        points.append({
            "id": hashlib.md5(chunk_id.encode()).hexdigest(),
            "vector": embedding,
            "payload": {
                "chunk_id": chunk_id,
                "document_id": doc_id,
                "content": chunk,
                "filename": file.filename,
                "chunk_index": i
            }
        })

    # Store in Qdrant
    if points:
        await ensure_collection_exists(collection_id, len(embeddings[0]) if embeddings else 768)
        await store_vectors(collection_id, points)

    # Create document record
    document = Document(
        id=doc_id,
        collection_id=collection_id,
        filename=file.filename or "unknown",
        content_type=file.content_type or "text/plain",
        size_bytes=len(content),
        chunk_count=len(chunks),
        created_at=now,
        metadata={"chunking": strategy.model_dump()}
    )

    _documents[doc_id] = document

    # Update collection stats
    collection.document_count += 1
    collection.chunk_count += len(chunks)
    collection.updated_at = now

    return document


@router.get("/documents")
async def list_documents(collection_id: Optional[str] = None) -> list[Document]:
    """List documents, optionally filtered by collection."""
    docs = list(_documents.values())
    if collection_id:
        docs = [d for d in docs if d.collection_id == collection_id]
    return docs


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and its chunks."""
    if document_id not in _documents:
        raise HTTPException(status_code=404, detail="Document not found")

    document = _documents[document_id]

    # Delete chunks
    chunk_ids = [cid for cid, c in _chunks.items() if c["document_id"] == document_id]
    for chunk_id in chunk_ids:
        del _chunks[chunk_id]

    # Update collection stats
    if document.collection_id in _collections:
        collection = _collections[document.collection_id]
        collection.document_count -= 1
        collection.chunk_count -= document.chunk_count

    del _documents[document_id]
    return {"status": "deleted"}


@router.post("/embed")
async def generate_embeddings(request: EmbeddingRequest):
    """Generate embeddings for text."""
    embeddings = await generate_embedding(request.text, request.model)
    return {
        "embeddings": embeddings,
        "model": request.model,
        "dimensions": len(embeddings[0]) if embeddings else 0
    }


@router.post("/search")
async def semantic_search(request: SearchRequest) -> list[SearchResult]:
    """Perform semantic search across documents."""
    # Generate query embedding
    query_embeddings = await generate_embedding(request.query)
    query_vector = query_embeddings[0] if query_embeddings else []

    if not query_vector:
        return []

    results = []

    # Search in Qdrant if collection specified
    if request.collection_id:
        qdrant_results = await search_vectors(
            request.collection_id,
            query_vector,
            request.limit,
            request.score_threshold
        )

        for r in qdrant_results:
            payload = r.get("payload", {})
            results.append(SearchResult(
                chunk_id=payload.get("chunk_id", ""),
                document_id=payload.get("document_id", ""),
                content=payload.get("content", ""),
                score=r.get("score", 0.0),
                metadata={"filename": payload.get("filename", "")}
            ))
    else:
        # Search all collections in memory (fallback)
        import numpy as np
        for chunk_id, chunk_data in _chunks.items():
            if not chunk_data.get("embedding"):
                continue

            # Cosine similarity
            a = np.array(query_vector)
            b = np.array(chunk_data["embedding"])
            score = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

            if score >= request.score_threshold:
                results.append(SearchResult(
                    chunk_id=chunk_id,
                    document_id=chunk_data["document_id"],
                    content=chunk_data["content"],
                    score=score,
                    metadata=chunk_data.get("metadata", {})
                ))

        # Sort by score and limit
        results.sort(key=lambda x: x.score, reverse=True)
        results = results[:request.limit]

    return results


@router.post("/rag")
async def get_rag_context(request: RAGRequest) -> RAGContext:
    """Get RAG context for chat injection.

    Returns relevant document chunks formatted for injection
    into the chat system prompt or context.
    """
    # Perform semantic search
    search_results = await semantic_search(SearchRequest(
        query=request.query,
        collection_id=request.collection_id,
        limit=request.limit,
        score_threshold=0.5
    ))

    # Build context text
    context_parts = []
    total_chars = 0
    max_chars = request.max_tokens * 4  # Rough estimate: 4 chars per token

    for result in search_results:
        if total_chars + len(result.content) > max_chars:
            break

        if request.include_sources:
            source = result.metadata.get("filename", "unknown")
            context_parts.append(f"[Source: {source}]\n{result.content}")
        else:
            context_parts.append(result.content)

        total_chars += len(result.content)

    context_text = "\n\n---\n\n".join(context_parts)

    return RAGContext(
        query=request.query,
        results=search_results[:len(context_parts)],
        total_tokens=total_chars // 4,
        context_text=context_text
    )


@router.get("/stats")
async def get_knowledge_stats():
    """Get knowledge base statistics."""
    return {
        "collections": len(_collections),
        "documents": len(_documents),
        "chunks": len(_chunks),
        "collections_list": [
            {
                "id": c.id,
                "name": c.name,
                "documents": c.document_count,
                "chunks": c.chunk_count
            }
            for c in _collections.values()
        ]
    }
