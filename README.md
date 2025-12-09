# Ollama Workbench 2.0

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
git clone https://github.com/yourusername/ollama-workbench-2.git
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

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/ollama/tags` | List available models |
| `POST /api/chat` | Chat completion (streaming) |
| `GET /api/prompts` | List prompt templates |
| `GET /api/mcp/servers` | List MCP servers |

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

### Phase 1: Foundation (Current)
- [x] Project scaffolding
- [x] Chat interface with streaming
- [x] Settings management
- [ ] Model selection and management

### Phase 2: Developer Tools
- [ ] Tools debugger with call tracing
- [ ] Prompt lab with versioning
- [ ] MCP server management

### Phase 3: Advanced Features
- [ ] Multi-agent builder
- [ ] RAG pipeline integration
- [ ] OpenAI-compatible API

### Phase 4: Production
- [ ] Desktop app release
- [ ] Plugin system
- [ ] Team collaboration features

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with Svelte, Tauri, and FastAPI
