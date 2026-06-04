# Backend — Codebase Overview

## Stack

- **Framework**: FastAPI (Python 3.12)
- **Server**: Uvicorn
- **Package manager**: uv (used inside Docker)
- **Database**: SQLite at `/data/kanban.db` (volume-mounted for persistence)

## Project structure

```
backend/
  main.py           # FastAPI app entry point; defines all routes; mounts static files
  pyproject.toml    # Python project metadata and dependencies
  static/           # Served at /; populated with the Next.js export in Part 3
                    # (contains a placeholder index.html for Part 2)
  AGENTS.md         # This file
```

Future additions (added in later parts):
```
  database.py       # SQLite connection, table creation, seed data
  auth.py           # Session cookie helpers
  routers/
    auth.py         # /api/auth/login, /api/auth/logout
    board.py        # /api/board, /api/columns, /api/cards
    ai.py           # /api/ai/ping, /api/ai/chat
  ai.py             # Anthropic Claude helper
```

## Routes (Part 2)

| Method | Path          | Description          |
|--------|---------------|----------------------|
| GET    | /api/health   | Returns {"status":"ok"} |
| GET    | /             | Serves static/index.html |

## Static file serving

FastAPI mounts `backend/static/` at `/` using `StaticFiles(html=True)`, which serves `index.html` for any unmatched path (SPA fallback). API routes defined before the mount take priority.

## Running locally (without Docker)

```bash
cd backend
uv pip install .       # or: pip install -e .
uvicorn main:app --reload
```

## Docker

Built from the project-root `Dockerfile`. The container:
- Installs Python deps via uv
- Copies `backend/` to `/app/`
- Mounts host `./data` → `/data` for SQLite persistence
- Exposes port 8000

`CLAUDE_API_KEY` is passed in via `docker-compose.yml` from the host environment (reads from `.env` in the project root).

## Key conventions

- All API routes are prefixed `/api/`.
- The SQLite file path is `/data/kanban.db`.
- Never log or return the API key in any response.
- Use `TestClient` from FastAPI for all pytest tests.