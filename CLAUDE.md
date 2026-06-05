# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Kanban project management web app. A single user (`user` / `password`) signs in and manages a board with 5 fixed columns. An AI chat sidebar (powered by Claude) can create, edit, move, and delete cards via tool use.

## Running the app

**Production (Docker):**
```bash
scripts/start.sh    # builds + starts at http://localhost:8000
scripts/stop.sh     # tears it down
```
Requires `CLAUDE_API_KEY` in `.env` at the project root.

**Local development (frontend + backend separately):**
```bash
# Backend
cd backend
uv pip install -e .
uvicorn main:app --reload   # runs on :8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # runs on :3000, proxies /api/* to :8000
```

## Commands

**Frontend:**
```bash
cd frontend
npm run test:unit           # Vitest unit + component tests
npm run test:unit:watch     # watch mode
npm run test:e2e            # Playwright (requires running dev server)
npm run lint
npm run build               # static export to frontend/out/
```

**Backend:**
```bash
cd backend
pytest                      # all tests
pytest tests/test_board.py  # single file
```
Backend tests use a temp SQLite file via `DB_PATH` env var (set in `conftest.py`).

## Architecture

The Docker build is two-stage: Next.js compiles to a static export (`next build` → `frontend/out/`), then that output is copied into `backend/static/`. FastAPI serves the static site at `/` and all API routes at `/api/*`.

**Backend modules** (`backend/`):
- `main.py` — all FastAPI routes; imports from the modules below
- `database.py` — SQLite helpers: `init_db`, `fetch_board`, `apply_kanban_update`, card/column CRUD
- `auth.py` — signed session cookie via `itsdangerous`; `verify_session` is a FastAPI dependency
- `ai.py` — Anthropic SDK calls; `chat_with_claude` returns `AIResponse` (message + optional `KanbanUpdate`)

**Frontend** (`frontend/src/`):
- `components/KanbanBoard.tsx` — owns all board state in a single `useState<BoardData>`; orchestrates DnD
- `components/AIChatSidebar.tsx` — chat UI; calls `postChat` from `lib/api.ts`; receives updated board and calls setter
- `lib/kanban.ts` — types (`Card`, `Column`, `BoardData`) and pure logic
- `lib/api.ts` — typed fetch wrappers for all backend endpoints

**Database schema:** `users` → `boards` → `columns` → `cards`. Cards carry a `position` integer for ordering within a column. `apply_kanban_update` does a full-replace per column (deletes unlisted cards, upserts the rest).

**AI tool use pattern:** The frontend sends the full current board JSON with each chat request. Claude can call the `update_kanban` tool, which specifies only the changed columns (each column's card list fully replaces that column). The backend applies the update and returns the refreshed board in the same response.

## Key conventions

- All API routes are prefixed `/api/`; static file mount comes last in `main.py` so API routes win
- Auth: `verify_session` FastAPI dependency on every protected route
- Card and column IDs are integers in the DB but serialized as strings in the API/frontend
- Frontend `data-testid` attributes follow `column-{id}` and `card-{id}`
- Tailwind CSS v4 with CSS custom properties defined in `globals.css` — no `tailwind.config` file
- No global state library; all board state lives in `KanbanBoard`
- SQLite DB path defaults to `/data/kanban.db`; override with `DB_PATH` env var (used in tests)

## Color scheme

| Variable              | Hex       | Usage                          |
|-----------------------|-----------|-------------------------------|
| `--accent-yellow`     | `#ecad0a` | Accent lines, highlights       |
| `--primary-blue`      | `#209dd7` | Links, key sections            |
| `--secondary-purple`  | `#753991` | Submit buttons, actions        |
| `--navy-dark`         | `#032147` | Main headings, body text       |
| `--gray-text`         | `#888888` | Supporting text, labels        |
