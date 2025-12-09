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

# Run all tests
npm run test

# Frontend tests only
npm run test:web

# Backend tests only
cd packages/api && pytest

# Single test file
cd packages/api && pytest tests/test_chat.py -v

# Desktop development (requires Rust)
cd apps/desktop && npm run tauri dev

# Docker deployment
docker-compose up -d
```

## Project Structure

```
apps/
├── web/                    # SvelteKit frontend
│   └── src/
│       ├── lib/
│       │   ├── components/ # Svelte components
│       │   │   ├── chat/   # Chat interface components
│       │   │   ├── common/ # Shared components (Header, Sidebar, ModelSelector)
│       │   │   └── workflow/ # Node-based editor components
│       │   └── stores/     # Svelte stores (state management)
│       └── routes/         # SvelteKit pages
│           ├── chat/       # Chat interface
│           ├── build/      # Agent builder (node editor)
│           ├── tools/      # Tools debugger
│           ├── mcp/        # MCP server management
│           ├── prompts/    # Prompt lab
│           └── knowledge/  # Knowledge base (RAG)
└── desktop/               # Tauri wrapper for desktop builds

packages/
└── api/                   # FastAPI backend
    └── src/
        ├── main.py        # App entry, CORS, router setup
        └── routers/       # API route handlers
            ├── chat.py    # Streaming chat via Ollama
            ├── ollama.py  # Model management
            ├── agents.py  # Agent configuration
            ├── tools.py   # Function calling
            ├── mcp.py     # MCP server integration
            └── prompts.py # Prompt templates
```

## Architecture

### State Management (Frontend)

Svelte stores in `apps/web/src/lib/stores/` manage application state:
- `chat.ts` - Conversations, messages, branching, voice settings (persisted to localStorage)
- `models.ts` - Available Ollama models
- `settings.ts` - User preferences
- `connection.ts` - API connection status

Derived stores provide computed views (activeConversation, activeMessages filtered by branch).

### API Communication

The frontend communicates with the FastAPI backend which proxies to Ollama:
1. Frontend sends chat request to `/api/chat`
2. Backend streams response from Ollama at `OLLAMA_HOST`
3. Responses are NDJSON (newline-delimited JSON) for streaming

### Chat Features

- **Branching**: Conversations support branching from any message point
- **Voice**: TTS/STT integration via voice settings
- **Export**: JSON, Markdown, HTML export of conversations
- **Tool Calls**: Function calling support with result display

### Workflow Editor

Uses XYFlow (`@xyflow/svelte`) for visual agent orchestration:
- `AgentNode` - LLM agent configuration
- `ToolNode` - Function/tool integration
- `InputNode` / `OutputNode` - Workflow I/O

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `DATABASE_URL` | SQLite database path | `sqlite:///data/workbench.db` |
| `QDRANT_HOST` | Qdrant hostname | `localhost` |
| `QDRANT_PORT` | Qdrant port | `6333` |

### CORS Origins

Backend allows: `localhost:5173` (dev), `localhost:1420` (Tauri dev), `tauri://localhost` (desktop)

## Python Backend

Uses hatchling build system. Development setup:
```bash
cd packages/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"  # Includes pytest, ruff
```

Linting with ruff: line length 100, Python 3.11 target.
