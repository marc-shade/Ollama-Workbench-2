<img width="300" height="300" alt="ollama-workbench" src="https://github.com/user-attachments/assets/580b187f-7009-49df-83ba-4ab8db27b534" align="right" /># Ollama Workbench 2.0

**The Developer's Local LLM IDE** - A professional-grade workbench for local AI development, testing, and orchestration.

**FEATURES**

### Core
- **Chat Studio** - Streaming conversations with conversation branching, voice mode, and export (JSON/Markdown/HTML)
- **Multi-Agent Builder** - Visual workflow orchestration with node-based editor
- **Tools Debugger** - Test, trace, and debug function calling with model comparison
- **MCP Studio** - Build, test, and manage MCP servers
- **Prompt Lab** - Version-controlled prompt engineering with A/B testing
- **Knowledge Base** - Document management, URL scraping, and RAG pipeline

### Project & Planning
- **Project Management** - Full project lifecycle with tasks, priorities, and status tracking
- **AI Planning** - Generate project plans, task breakdowns, milestones, and risk identification
- **Repository Analysis** - Clone repos, browse files, search code, view language statistics

### Testing & Comparison
- **Model Feature Tests** - Test vision, JSON mode, tool calling, streaming, context window
- **Model Comparison** - Side-by-side text and vision comparison across multiple models
- **Server Monitoring** - Real-time Ollama server status, running models, VRAM usage

### Research & Development
- **Brainstorm Mode** - Creative ideation with AI assistance
- **Research Lab** - Deep research workflows
- **Code Sandbox** - Safe code execution environment

### Configuration
- **External Providers** - Configure OpenAI, Anthropic, Groq, Google Search, Serper, YouTube APIs
- **Episodic Memory** - Session/episodic/semantic memory with consolidation

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

- Node.js 20+ (or pnpm)
- Python 3.12+
- [Ollama](https://ollama.ai) installed and running
- (Optional) Rust for Tauri desktop builds

### Development

```bash
# Clone the repository
git clone https://github.com/marc-shade/Ollama-Workbench-2.git
cd ollama-workbench-2

# Install dependencies (using pnpm)
pnpm install

# Set up Python environment
cd packages/api
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .
cd ../..

# Start development servers
pnpm dev
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
pnpm install
pnpm tauri dev
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
│   │   │       ├── chat/        # Chat Studio
│   │   │       ├── projects/    # Project Management
│   │   │       ├── planning/    # AI Planning
│   │   │       ├── repos/       # Repository Analysis
│   │   │       ├── brainstorm/  # Brainstorm Mode
│   │   │       ├── build/       # Multi-Agent Builder
│   │   │       ├── models/      # Model Management
│   │   │       │   └── tests/   # Model Feature Tests
│   │   │       ├── compare/     # Model Comparison
│   │   │       ├── tools/       # Tools Debugger
│   │   │       ├── mcp/         # MCP Studio
│   │   │       ├── prompts/     # Prompt Lab
│   │   │       ├── knowledge/   # Knowledge Base
│   │   │       ├── research/    # Research Lab
│   │   │       ├── sandbox/     # Code Sandbox
│   │   │       ├── monitoring/  # Server Monitoring
│   │   │       └── settings/    # Settings
│   │   └── package.json
│   └── desktop/             # Tauri desktop wrapper
│       └── src-tauri/
├── packages/
│   └── api/                 # FastAPI backend
│       └── src/
│           └── routers/
│               ├── chat.py
│               ├── ollama.py
│               ├── agents.py
│               ├── tools.py
│               ├── mcp.py
│               ├── prompts.py
│               ├── knowledge.py
│               ├── memory.py
│               ├── projects.py
│               ├── planning.py
│               ├── repos.py
│               ├── model_tests.py
│               ├── compare.py
│               └── openai_compat.py
├── docs/
│   └── FEATURE-GAP-ANALYSIS.md
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

### External Providers

Configure API keys in Settings > Providers:
- **LLM Providers**: OpenAI (with custom base URL), Anthropic, Groq
- **Search APIs**: Google Custom Search, Serper, YouTube

## API Endpoints

### Core APIs
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/ollama/tags` | List available models |
| `GET /api/ollama/status` | Server monitoring data |
| `POST /api/chat` | Chat completion (streaming) |
| `GET /api/prompts` | List prompt templates |
| `GET /api/mcp/servers` | List MCP servers |

### Project & Planning
| Endpoint | Description |
|----------|-------------|
| `GET /api/projects` | List projects |
| `POST /api/projects` | Create project |
| `POST /api/planning/generate` | Generate AI project plan |
| `POST /api/planning/refine-task` | Refine task with subtasks |
| `POST /api/planning/analyze` | Analyze project for recommendations |

### Repository Analysis
| Endpoint | Description |
|----------|-------------|
| `POST /api/repos/clone` | Clone a repository |
| `POST /api/repos/local` | Add local repository |
| `GET /api/repos/{id}/files` | Browse repository files |
| `GET /api/repos/{id}/search` | Search within repository |

### Model Testing & Comparison
| Endpoint | Description |
|----------|-------------|
| `POST /api/model-tests/run` | Run capability tests on model |
| `GET /api/model-tests/compare` | Compare multiple models |
| `POST /api/compare/text` | Compare text responses |
| `POST /api/compare/vision/upload` | Compare vision model responses |

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
| `POST /api/knowledge/url` | Import content from URL |
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
pnpm dev       # Development server
pnpm build     # Production build
pnpm check     # Type checking
pnpm lint      # Linting
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
pnpm tauri dev    # Development
pnpm tauri build  # Production build
```

## Feature Status

### Implemented (110%+ of v1)

| Category | Features |
|----------|----------|
| **Chat** | Streaming, branching, voice mode, export formats |
| **Agents** | Types, metacognitive modes, voice types, IAP, custom thinking |
| **Projects** | CRUD, tasks, priorities, status tracking, export |
| **Planning** | AI plan generation, task breakdown, milestones, risks |
| **Repos** | Clone, browse, search, language stats |
| **Models** | Management, pull/delete, feature tests, comparison |
| **Tools** | Library, debugger, tracing, model comparison |
| **MCP** | Server management, tool builder, testing playground |
| **Prompts** | Library, versioning, A/B testing, metrics |
| **Knowledge** | Documents, URL import, chunking, RAG pipeline |
| **Memory** | Session, episodic, semantic, consolidation |
| **Monitoring** | Server status, running models, VRAM usage |
| **Providers** | OpenAI, Anthropic, Groq, search APIs |

### Roadmap

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
