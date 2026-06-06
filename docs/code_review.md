# Code Review

Reviewed: 2026-06-05. Covers all source files across `backend/` and `frontend/src/`.

---

## High priority

### 1. SESSION_SECRET is not set in docker-compose — session cookies are forgeable

**File:** `backend/auth.py:6`, `docker-compose.yml`

`_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-in-production")` falls back to the hardcoded string because `SESSION_SECRET` is never passed into the container. Anyone who knows the default (it is public) can sign a valid session cookie for any username.

**Fix:** Add `SESSION_SECRET` to `docker-compose.yml` and `.env`:

```yaml
environment:
  - CLAUDE_API_KEY=${CLAUDE_API_KEY}
  - SESSION_SECRET=${SESSION_SECRET}
```

Generate a strong value: `python3 -c "import secrets; print(secrets.token_hex(32))"`.

---

### 2. Optimistic UI updates are not rolled back on API failure

**File:** `frontend/src/components/KanbanBoard.tsx:122-199`

Both `handleDragEnd` and `handleRenameColumn` apply the state change before the API call succeeds. If the API returns an error, the UI shows the new state (moved card / renamed column) while the database still has the old state. The error message is shown but the board is not reverted, leaving the UI and DB permanently out of sync until the user reloads.

**Fix:** Save the previous board state before mutating and restore it on failure:

```ts
const handleDragEnd = async (event: DragEndEvent) => {
  // ...
  const prevColumns = board.columns;
  setBoard((prev) => prev ? { ...prev, columns: nextColumns } : prev);
  try {
    const response = await fetch(...);
    if (!response.ok) {
      setBoard((prev) => prev ? { ...prev, columns: prevColumns } : prev);
      setError("Unable to move card.");
    }
  } catch {
    setBoard((prev) => prev ? { ...prev, columns: prevColumns } : prev);
    setError("Unable to move card.");
  }
};
```

Apply the same pattern to `handleRenameColumn`.

---

## Medium priority

### 3. Error banner is never cleared after a successful subsequent action

**File:** `frontend/src/components/KanbanBoard.tsx`

`setError(null)` is only called at the start of `loadBoard`. After a "Unable to move card" error, the banner persists even after the user successfully performs another action. Each handler should call `setError(null)` on success.

---

### 4. `denormalizeBoard` is recomputed on every render

**File:** `frontend/src/components/KanbanBoard.tsx:457`

```tsx
<AIChatSidebar
  board={denormalizeBoard(board)}
  ...
```

`denormalizeBoard` iterates all columns and cards on every render of `KanbanBoard`. It should be wrapped in `useMemo`:

```ts
const denormalizedBoard = useMemo(
  () => (board ? denormalizeBoard(board) : null),
  [board]
);
```

---

### 5. `@app.on_event("startup")` is deprecated

**File:** `backend/main.py:22`

FastAPI has deprecated `@app.on_event` in favour of the `lifespan` context manager. This currently produces a deprecation warning on every test run and server start.

**Fix:**

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
```

---

### 6. `test_card_endpoints_require_auth` only tests one endpoint

**File:** `backend/tests/test_board.py:14`

The test name implies all card endpoints require auth, but it only tests `POST /api/cards`. The `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}`, and `PATCH /api/cards/{id}/move` endpoints are not covered.

**Fix:** Expand the test:

```python
def test_card_endpoints_require_auth(client):
    assert client.post("/api/cards", json={"columnId": 1, "title": "x"}).status_code == 401
    assert client.patch("/api/cards/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/cards/1").status_code == 401
    assert client.patch("/api/cards/1/move", json={"columnId": 1, "position": 0}).status_code == 401
```

---

### 7. `test_board_crud_flow` does not test update-card or cross-column move

**File:** `backend/tests/test_board.py:20`

The CRUD flow test creates, renames, moves (same column), and deletes a card. It does not test:
- `PATCH /api/cards/{id}` — update title/details
- Moving a card to a *different* column (the most complex branch of `apply_kanban_update`)

---

## Low priority

### 8. `createId` uses `Math.random()` instead of `crypto.randomUUID()`

**File:** `frontend/src/lib/kanban.ts:164`

The `frontend/AGENTS.md` specifies `createId` should use `crypto.randomUUID()`, but the implementation uses `Math.random()`. This function is only used in the offline (`useApi=false`) test path today, so it has no production impact. It should match the documented intent:

```ts
export const createId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID()}`;
```

---

### 9. Duplicated background gradient markup

**File:** `frontend/src/components/KanbanBoard.tsx:334-339, 346-351, 357-358`, `frontend/src/app/login/page.tsx:63-64`

The two radial-gradient `div` decorations are copy-pasted into the loading state, empty board state, main board render, and the login page. A small shared `Background` component would remove the duplication.

---

### 10. No tests for `AIChatSidebar`

**File:** `frontend/src/components/AIChatSidebar.tsx`

The plan listed unit tests for the sidebar as a success criterion for Part 10, but none exist. At minimum: renders an empty state; appends a user message on send; calls `onBoardUpdate` when the response includes a board.

---

## Deprecation warnings (non-breaking)

| Warning | Location | Fix |
|---------|----------|-----|
| `on_event` deprecated | `backend/main.py:22` | Use `lifespan` (see item 5) |
| `httpx` → `httpx2` for `TestClient` | `backend/.venv` dependency | `uv add httpx2` and remove `httpx` |

---

## Summary

| # | Severity | Area | Action |
|---|----------|------|--------|
| 1 | High | Security | Set `SESSION_SECRET` env var in docker-compose |
| 2 | High | Correctness | Roll back optimistic UI state on API failure |
| 3 | Medium | UX | Clear error banner on subsequent successful actions |
| 4 | Medium | Performance | Memoize `denormalizeBoard` |
| 5 | Medium | Deprecation | Migrate `on_startup` to `lifespan` |
| 6 | Medium | Tests | Expand auth guard test to all card endpoints |
| 7 | Medium | Tests | Add cross-column move and update-card test cases |
| 8 | Low | Correctness | Use `crypto.randomUUID()` in `createId` |
| 9 | Low | Cleanup | Extract shared background gradient component |
| 10 | Low | Tests | Add `AIChatSidebar` unit tests |
