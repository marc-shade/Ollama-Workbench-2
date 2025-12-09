# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ollama Workbench 2.0 is a local LLM IDE for AI development, testing, and orchestration. It provides a web interface for chatting with local models via Ollama, visual agent building, tools debugging, MCP server management, and prompt engineering.

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, Tailwind CSS, XYFlow (node editor)
- **Desktop**: Tauri 2.0 (Rust wrapper)
- **Backend**: FastAPI, Python 3.11+
- **Database**: SQLite (metadata), Qdrant (vectors)
- **AI**: Ollama (local inference)

## Development Commands

```bash
# Start both frontend and API together
npm run dev

# Frontend only (SvelteKit on port 5173)
cd apps/web && npm run dev

# Backend only (FastAPI on port 8000)
cd packages/api && uvicorn src.main:app --reload --port 8000

# Type checking (frontend)
npm run check

# Linting (frontend)
npm run lint

# Format code (frontend)
cd apps/web && npm run format

# Run all tests
npm run test

# Backend tests only
cd packages/api && pytest

# Single test file
cd packages/api && pytest tests/test_chat.py -v

# Desktop development (requires Rust)
cd apps/desktop && npm run tauri dev

# Docker deployment
docker-compose up -d
```

## Architecture

### Data Flow

```
Browser → SvelteKit (5173) → FastAPI (8000) → Ollama (11434)
                                   ↓
                            SQLite / Qdrant
```

Chat requests stream NDJSON from Ollama through FastAPI to the frontend.

### State Management (Frontend)

Svelte stores in `apps/web/src/lib/stores/` persist to localStorage:
- `chat.ts` - Conversations with branching support, voice settings
- `workflow.ts` - Node editor state
- `knowledge.ts` - RAG document collections
- `settings.ts` / `agentSettings.ts` - User and agent preferences

Derived stores filter data (e.g., `activeMessages` filters by branch).

### Backend Routers

Each router in `packages/api/src/routers/` maps to an API prefix:
- `/api/chat` - Streaming chat with agent settings (metacognitive prompts, IAP)
- `/api/ollama` - Model management, server status
- `/api/knowledge` - Document upload, chunking, RAG queries
- `/api/memory` - Episodic memory sessions
- `/api/projects` - Project CRUD with tasks
- `/api/planning` - AI-generated project plans
- `/api/repos` - Git repository cloning/browsing
- `/api/model-tests` - Capability testing (vision, tools, JSON mode)
- `/api/compare` - Side-by-side model comparison
- `/v1/*` - OpenAI-compatible API

### Chat Agent Settings

The chat system supports advanced agent configuration:
- **Metacognitive types**: Chain-of-thought, Tree-of-thought, Self-reflection, Socratic, First-principles
- **IAP (Instance-Adaptive Prompting)**: Single-saliency (ss) and Multi-vote (mv) strategies
- **Custom thinking steps**: User-defined reasoning workflows

### Conversation Branching

Messages track `branchId` and `parentBranchId`. The `activeMessages` derived store resolves which messages to display by walking the branch hierarchy from fork points.

### Workflow Editor

Uses XYFlow (`@xyflow/svelte`) for visual agent orchestration with node types:
- `AgentNode`, `ToolNode`, `InputNode`, `OutputNode`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `DATABASE_URL` | SQLite database path | `sqlite:///data/workbench.db` |
| `QDRANT_HOST` | Qdrant hostname | `localhost` |
| `QDRANT_PORT` | Qdrant port | `6333` |

### Remote Ollama

```bash
export OLLAMA_HOST=http://192.168.1.186:11434
```

### CORS Origins

Backend allows: `localhost:5173` (dev), `localhost:1420` (Tauri dev), `tauri://localhost` (desktop)

## Python Backend Setup

```bash
cd packages/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"  # Includes pytest, ruff
```

Linting with ruff: line length 100, Python 3.11 target.

## Key API Endpoints

Full docs at `http://localhost:8000/docs` when running.

| Endpoint | Description |
|----------|-------------|
| `POST /api/chat` | Streaming chat with agent settings |
| `GET /api/ollama/tags` | List available models |
| `POST /api/knowledge/documents` | Upload and embed document |
| `POST /api/knowledge/rag` | Get RAG context |
| `POST /api/memory/store` | Store episodic memory |
| `POST /api/planning/generate` | AI-generate project plan |
| `POST /v1/chat/completions` | OpenAI-compatible endpoint |
