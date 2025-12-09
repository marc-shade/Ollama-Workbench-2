<img width="300" height="300" alt="ollama-workbench" src="https://github.com/user-attachments/assets/580b187f-7009-49df-83ba-4ab8db27b534" align="right" /># Ollama Workbench 2.0

**The Developer's Local LLM IDE** - A professional-grade workbench for local AI development, testing, and orchestration.

## Features

- **Chat Interface** - Streaming conversations with local models via Ollama
- **Agent Builder** - Visual multi-agent orchestration with node-based editor
- **Tools Debugger** - Test, trace, and debug function calling
- **MCP Studio** - Build, test, and manage MCP servers
- **Prompt Lab** - Version-controlled prompt engineering
- **Knowledge Base** - Document management and RAG pipeline

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2, Svelte 5, Tailwind CSS |
| Desktop | Tauri 2.0 |
| Backend | FastAPI, Python 3.12+ |
| Database | SQLite (metadata), Qdrant (vectors) |
| AI | Ollama (local inference) |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- [Ollama](https://ollama.ai) installed and running
- (Optional) Rust for Tauri desktop builds

### Development

```bash
# Clone the repository
git clone https://github.com/marc-shade/Ollama-Workbench-2.git
cd ollama-workbench-2

# Install frontend dependencies
cd apps/web && npm install && cd ../..

# Set up Python environment
cd packages/api
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .
cd ../..

# Start development servers
npm run dev
```

The web app will be available at `http://localhost:5173` and the API at `http://localhost:8000`.

### Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- Web UI: `http://localhost:3000`
- API: `http://localhost:8000`
- Qdrant: `http://localhost:6333`

### Desktop App (Tauri)

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## Project Structure

```
ollama-workbench-2/
├── apps/
│   ├── web/                 # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   └── stores/
│   │   │   └── routes/
│   │   │       ├── chat/
│   │   │       ├── build/
│   │   │       ├── tools/
│   │   │       ├── mcp/
│   │   │       ├── prompts/
│   │   │       ├── knowledge/
│   │   │       └── settings/
│   │   └── package.json
│   └── desktop/             # Tauri desktop wrapper
│       └── src-tauri/
├── packages/
│   └── api/                 # FastAPI backend
│       └── src/
│           └── routers/
├── docker/
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── docker-compose.yml
└── package.json
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `DATABASE_URL` | SQLite database path | `sqlite:///data/workbench.db` |
| `QDRANT_HOST` | Qdrant server hostname | `localhost` |
| `QDRANT_PORT` | Qdrant server port | `6333` |

### Remote Ollama

To use a remote Ollama instance:

```bash
# Set in .env or export
export OLLAMA_HOST=http://192.168.1.186:11434
```

## API Endpoints

### Core APIs
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/ollama/tags` | List available models |
| `POST /api/chat` | Chat completion (streaming) |
| `GET /api/prompts` | List prompt templates |
| `GET /api/mcp/servers` | List MCP servers |

### OpenAI-Compatible API
| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI-compatible chat completions |
| `GET /v1/models` | List available models (OpenAI format) |

### Knowledge Base (RAG)
| Endpoint | Description |
|----------|-------------|
| `POST /api/knowledge/collections` | Create a document collection |
| `POST /api/knowledge/documents` | Upload and embed a document |
| `POST /api/knowledge/search` | Semantic search across documents |
| `POST /api/knowledge/rag` | Get RAG context for chat |

### Episodic Memory
| Endpoint | Description |
|----------|-------------|
| `POST /api/memory/sessions` | Create a new session |
| `POST /api/memory/store` | Store a memory entry |
| `POST /api/memory/search` | Search memories semantically |
| `POST /api/memory/context` | Build context for chat injection |

Full API docs available at `http://localhost:8000/docs` when running.

## Development

### Frontend (SvelteKit)

```bash
cd apps/web
npm run dev       # Development server
npm run build     # Production build
npm run check     # Type checking
npm run lint      # Linting
```

### Backend (FastAPI)

```bash
cd packages/api
source .venv/bin/activate
uvicorn src.main:app --reload --port 8000
```

### Desktop (Tauri)

```bash
cd apps/desktop
npm run tauri dev    # Development
npm run tauri build  # Production build
```

## Roadmap

### Phase 1: Foundation ✅
- [x] Project scaffolding (SvelteKit 2 + FastAPI + Tauri 2.0)
- [x] Chat interface with streaming
- [x] Settings management
- [x] Model selection and management
- [x] **Comprehensive Agent Settings** (v1 feature parity+)
  - Agent Types (Coder, Analyst, Creative Writer, Researcher, Tutor, General)
  - Metacognitive Types (Chain of Thought, Tree of Thought, Visualization, Self-Reflection, Socratic, First Principles)
  - Voice Types (Professional, Friendly, Concise, Detailed, Casual, Academic, Encouraging)
  - Advanced Thinking with IAP (Instance-Adaptive Prompting)
  - Custom Thinking Steps
  - Full model parameters (temperature, penalties, mirostat, etc.)

### Phase 2: Developer Tools ✅
- [x] **Tools Debugger** - Complete function calling development environment
  - Tool library with CRUD operations and JSON schema editor
  - Visual tool builder with parameter configuration
  - Test execution with real-time results
  - Call tracing with detailed request/response inspection
  - Trace history with filtering and search
  - Model comparison for tool calling evaluation
- [x] **Prompt Lab** - Version-controlled prompt engineering
  - Prompt library with categories, search, and favorites
  - Version history with diff preview and restore
  - A/B testing with variant comparison
  - Execution metrics and performance tracking
- [x] **MCP Studio** - Build, test, and manage MCP servers
  - Server management (add, edit, delete, enable/disable)
  - Multiple transport support (stdio, SSE, HTTP)
  - Visual tool builder for MCP tools
  - Testing playground with live execution
  - Call history with request/response logging
- [x] **Knowledge Base** - Document management and RAG pipeline
  - Document upload with multiple chunking strategies
  - Collections management with metadata
  - Semantic search with relevance scoring
  - RAG pipeline configuration
  - Embedding generation and vector storage

### Phase 3: Advanced Features ✅
- [x] **Multi-agent Builder** - Visual workflow orchestration
  - Node-based editor with @xyflow/svelte
  - Custom agent, tool, input, and output nodes
  - Agent templates (Researcher, Writer, Coder, Critic, Orchestrator)
  - Execution monitoring with progress tracking
  - Workflow history and re-execution
- [x] **RAG Pipeline Integration** - Knowledge-augmented chat
  - Document collection management
  - Multiple chunking strategies (fixed, sentence, paragraph)
  - Embedding generation via Ollama
  - Semantic search with Qdrant
  - Context injection for chat
- [x] **OpenAI-Compatible API** - Drop-in replacement
  - `/v1/chat/completions` with streaming support
  - `/v1/models` for model listing
  - Tool/function calling support
  - Compatible with OpenAI SDKs
- [x] **Episodic Memory** - Persistent conversation memory
  - Session management for conversations
  - Memory storage (session, episodic, semantic types)
  - Semantic memory search
  - Memory consolidation (session → episodic promotion)
  - Context building for chat injection

### Phase 4: Production (Current)
- [ ] Desktop app release (macOS, Windows, Linux)
- [ ] Plugin system
- [ ] Team collaboration features
- [ ] Model fine-tuning interface

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with Svelte, Tauri, and FastAPI
