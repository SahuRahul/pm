# Project Plan — Project Management MVP

## Part 1: Plan (complete)

### Tasks
- [x] Read and understand the existing frontend code
- [x] Create `frontend/AGENTS.md` describing the frontend codebase
- [x] Enrich this PLAN.md with detailed substeps, tests, and success criteria for all parts
- [ ] User reviews and approves the plan

### Success criteria
- User has approved the plan before work on Part 2 begins.

---

## Part 2: Scaffolding

Set up Docker, the FastAPI backend skeleton, and start/stop scripts. Verify a "hello world" HTML response and a working API call before any real code is added.

### Tasks
- [x] Create `backend/` structure:
  - `backend/main.py` — FastAPI app, mounts static files at `/`, has `/api/health` route
  - `backend/pyproject.toml` for uv
- [x] Create `Dockerfile` at project root:
  - Single Python stage for Part 2; Node build stage will be added in Part 3
  - `python:3.12-slim` — installs uv, installs Python deps, copies backend
  - Exposes port 8000
  - SQLite data directory created at `/data` (volume-mount point)
- [x] Create `docker-compose.yml` at project root:
  - Mounts `./data` → `/data` for SQLite persistence
  - Maps host port 8000 → container 8000
- [x] Create start/stop scripts in `scripts/`:
  - `start.sh` / `stop.sh` (Mac/Linux)
  - `start.bat` / `stop.bat` (Windows cmd)
  - `start.ps1` / `stop.ps1` (Windows PowerShell)
  - Scripts use `docker compose up -d --build` / `docker compose down`
- [x] `backend/AGENTS.md` updated to describe the backend structure

### Tests & success criteria
- [x] `GET /api/health` returns `{"status": "ok"}` with HTTP 200
- [x] `GET /` returns an HTML response (placeholder `index.html` in static dir)
- [x] Container builds without errors: `docker compose build`
- [x] Container starts and serves on `http://localhost:8000`: `docker compose up -d`
- [x] Stop script cleanly halts the container

---

## Part 3: Add in Frontend

Replace the placeholder static HTML with the real Next.js frontend, statically exported and served by FastAPI.

### Tasks
- [x] Configure Next.js for static export:
  - Set `output: "export"` in `next.config.ts`
  - Confirm `next build` produces an `out/` directory
- [x] Update `Dockerfile` with Node build stage: copies `out/` into the Python image at `backend/static/`
- [x] FastAPI: serves `backend/static/` at `/` with SPA fallback via `StaticFiles(html=True)`
- [x] Verified the Kanban board renders at `http://localhost:8000/`

### Tests & success criteria
- [x] `npm run build` succeeds (no TypeScript or lint errors)
- [x] All existing frontend unit tests pass: `npm run test:unit` (6/6)
- [x] All existing frontend E2E tests pass: `npm run test:e2e` (3/3)
- [x] `docker compose build && docker compose up -d` — Kanban board visible in browser at `http://localhost:8000/`

---

## Part 4: Fake sign-in

Add a login wall in front of the Kanban. Hardcoded credentials only (`user` / `password`). No real auth infrastructure yet.

### Tasks
- [x] Frontend: create `/login` page with a username + password form
  - On submit, POST to `/api/auth/login` with credentials
  - On success, store a session token (httpOnly cookie set by backend)
  - On failure, show an inline error message
- [x] Frontend: protect the root `/` route — if no valid session cookie, redirect to `/login`
- [x] Frontend: add a "Log out" button in the board header; calls `/api/auth/logout` and redirects to `/login`
- [x] Backend: `POST /api/auth/login` — validates hardcoded credentials, sets a signed httpOnly cookie (use `itsdangerous` or similar; no JWT library needed)
- [x] Backend: `POST /api/auth/logout` — clears the cookie
- [x] Backend: auth dependency for protected routes — reads and validates the cookie

### Tests & success criteria
- [x] Unit test (frontend): login form shows error on bad credentials, redirects on success
- [x] Unit test (backend): `/api/auth/login` returns 200 + cookie on correct creds; 401 on wrong creds
- [x] E2E test: visiting `/` unauthenticated redirects to `/login`
- [x] E2E test: logging in with correct credentials shows the Kanban board
- [x] E2E test: logging out returns user to `/login`
- [x] E2E test: visiting `/` after logout redirects to `/login`

---

## Part 5: Database modeling

Define and document the SQLite schema before writing any backend data code.

### Tasks
- [x] Design schema covering: users, boards, columns, cards
- [x] Save schema as `docs/database.md` with:
  - Table definitions (DDL)
  - Explanation of relationships
  - Notes on how `BoardData` (frontend shape) maps to the schema
- [x] Get user sign-off on the schema before proceeding

### Schema (proposed)

```sql
CREATE TABLE users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT NOT NULL UNIQUE
);

CREATE TABLE boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL DEFAULT 'My Board'
);

CREATE TABLE columns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES boards(id),
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL  -- display order
);

CREATE TABLE cards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id  INTEGER NOT NULL REFERENCES columns(id),
  title      TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL  -- display order within column
);
```

### Success criteria
- User has reviewed and approved the schema before Part 6 begins

---

## Part 6: Backend data API

Implement CRUD API routes so the frontend can read and persist the Kanban board via the backend.

### Tasks
- [x] Database initialisation: on startup, create the SQLite database and tables if they do not exist; create the default `user` account and seed an empty board
- [x] `GET /api/board` — return the full board for the authenticated user as `BoardData` JSON
- [x] `PATCH /api/columns/{column_id}` — rename a column
- [x] `POST /api/cards` — create a new card in a column; return the new card with its id
- [x] `PATCH /api/cards/{card_id}` — update card title / details
- [x] `DELETE /api/cards/{card_id}` — delete a card
- [x] `PATCH /api/cards/{card_id}/move` — move a card to a different column and/or position
- [x] All routes protected by auth dependency from Part 4
- [x] Database file stored at `/data/kanban.db` (the volume-mounted path)

### Tests & success criteria
- [x] Pytest unit tests for every route (use `TestClient` from FastAPI)
- [x] Test: unauthenticated requests to all data routes return 401
- [x] Test: board is created and seeded on first run; subsequent runs return persisted data
- [x] Test: create, rename, move, and delete a card end-to-end via the API
- [x] Test: column rename persists
- [x] All pytest tests pass: `uv run pytest`

---

## Part 7: Frontend + Backend integration

Replace all in-memory frontend state with live API calls. The board is now fully persistent.

### Tasks
- [x] On mount, `KanbanBoard` fetches the board from `GET /api/board`
- [x] Column rename calls `PATCH /api/columns/{id}`
- [x] Add card calls `POST /api/cards`
- [x] Delete card calls `DELETE /api/cards/{id}`
- [x] Drag-and-drop end calls `PATCH /api/cards/{id}/move`
- [x] Show a loading state while the initial board fetch is in progress
- [x] On API error, surface a brief inline error message (no modal)
- [x] Remove all hardcoded `initialData` usage from production paths (keep it only in tests)

### Notes
- Fixed: column IDs and card IDs from SQLite both start at 1, causing dnd-kit to treat them as the same draggable/droppable. Fixed by adding `col-` / `card-` prefixes in `normalizeBoard()` in `KanbanBoard.tsx`, stripping before API calls.

### Tests & success criteria
- [x] All existing frontend unit tests still pass (mock the API in unit tests)
- [ ] New integration tests: board loads from API; mutations call correct endpoints
- [x] E2E test: add a card, reload the page — card is still there
- [x] E2E test: drag a card to a new column, reload — card is in new column
- [x] E2E test: delete a card, reload — card is gone
- [x] E2E test: rename a column, reload — new name persists

---

## Part 8: AI connectivity

Wire the backend to the Anthropic API (Claude Sonnet 4.6) and verify it works.

### Tasks
- [ ] Add `anthropic` to Python dependencies
- [ ] Read `CLAUDE_API_KEY` from environment (passed into container via `docker-compose.yml` env or `.env` file)
- [ ] Create `backend/ai.py` with a minimal `call_claude(messages)` helper
- [ ] Add `GET /api/ai/ping` route — sends `"What is 2+2?"` to Claude and returns the raw text response
- [ ] `docker-compose.yml`: pass `CLAUDE_API_KEY` from host environment into the container

### Tests & success criteria
- Pytest test: mock the Anthropic client; confirm `call_claude` sends correct message shape
- Manual test: `GET /api/ai/ping` returns a response containing "4"
- The API key is never logged or exposed in responses

---

## Part 9: AI Kanban assistant (backend)

Extend the AI call to include the current board state and conversation history. The AI responds with structured output that optionally modifies the board.

### Tasks
- [ ] Define a Pydantic response model:
  ```python
  class KanbanUpdate(BaseModel):
      columns: list[ColumnData] | None = None  # full replacement if provided

  class AIResponse(BaseModel):
      message: str          # the assistant's reply to the user
      kanban_update: KanbanUpdate | None = None
  ```
- [ ] `POST /api/ai/chat` — accepts `{ messages: [{role, content}], board: BoardData }`
  - Builds a system prompt containing the current board as JSON
  - Appends conversation history
  - Calls Claude with `response_format` / tool-use to return structured output
  - If `kanban_update` is present, applies the update to the database and returns the new board state
  - Returns `{ message, board }` where `board` is the (possibly updated) `BoardData`
- [ ] Auth-protected

### Tests & success criteria
- Pytest: mocked Claude call returns a valid `AIResponse`; board in DB is updated correctly when `kanban_update` is provided
- Pytest: missing/invalid structured output is handled gracefully (returns message, no board change)
- E2E-ready: `POST /api/ai/chat` with a real key returns a coherent message

---

## Part 10: AI chat sidebar (frontend)

Add an AI chat panel to the UI. The assistant can read and update the Kanban; changes are reflected immediately.

### Tasks
- [ ] Add a sidebar toggle button to the board header (icon + "AI Assistant" label)
- [ ] Sidebar component:
  - Scrollable message history (user + assistant bubbles)
  - Text input + send button at the bottom
  - Styled using existing CSS variables (no new color tokens)
- [ ] On send: POST to `/api/ai/chat` with message history and current board state
- [ ] On response: append assistant message to chat history
- [ ] If response includes a board update, replace board state in `KanbanBoard` — no page reload needed
- [ ] Show a loading indicator while waiting for the AI response
- [ ] Sidebar is collapsible; state persists for the session

### Tests & success criteria
- Unit test: sidebar renders; message is added to history on send
- Unit test: if AI response contains a board update, the board state is updated
- E2E test: type a message, receive a response, board reflects any changes
- No regression in existing Kanban unit or E2E tests