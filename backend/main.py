from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ai import AIResponse, KanbanUpdate, call_claude, chat_with_claude
from auth import clear_session, create_session, verify_session
from database import (
    apply_kanban_update,
    authenticate_user,
    create_board,
    create_column,
    create_user,
    delete_board,
    delete_column,
    delete_user,
    ensure_board,
    fetch_board,
    get_board_owner,
    get_column_cards,
    get_connection,
    get_user_by_username,
    init_db,
    list_boards,
    list_users,
    normalize_positions,
    reorder_column,
    reorder_columns,
    update_board,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


# --- Helpers ---

def _get_user_id(username: str) -> int:
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return int(row["id"])


def _require_board_access(user_id: int, board_id: int) -> None:
    """Raise 403/404 if the user doesn't own the board."""
    with get_connection() as conn:
        owner = get_board_owner(conn, board_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Board not found")
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Access denied")


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    with get_connection() as conn:
        user = authenticate_user(conn, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    create_session(response, body.username)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(verify_session)):
    with get_connection() as conn:
        user = get_user_by_username(conn, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"username": user["username"], "email": user["email"], "role": user["role"]}


@app.post("/api/auth/register")
def register(body: RegisterRequest):
    if len(body.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    with get_connection() as conn:
        existing = get_user_by_username(conn, body.username)
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        user_id = create_user(conn, body.username, body.password, body.email)
        ensure_board(conn, user_id)
        conn.commit()
    return {"ok": True, "username": body.username}


# --- User management (admin) ---

def _require_admin(username: str = Depends(verify_session)) -> str:
    with get_connection() as conn:
        user = get_user_by_username(conn, username)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username


@app.get("/api/users")
def list_all_users(username: str = Depends(_require_admin)):
    with get_connection() as conn:
        return list_users(conn)


@app.delete("/api/users/{user_id}")
def remove_user(user_id: int, admin: str = Depends(_require_admin)):
    with get_connection() as conn:
        user = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user["username"] == admin:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        deleted = delete_user(conn, user_id)
        conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# --- Boards ---

class CreateBoardRequest(BaseModel):
    name: str
    description: str = ""


class UpdateBoardRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class ReorderColumnsRequest(BaseModel):
    columnIds: list[int]


@app.get("/api/boards")
def get_boards(username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        return list_boards(conn, user_id)


@app.post("/api/boards")
def new_board(body: CreateBoardRequest, username: str = Depends(verify_session)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Board name cannot be empty")
    user_id = _get_user_id(username)
    with get_connection() as conn:
        board = create_board(conn, user_id, body.name.strip(), body.description)
        conn.commit()
    return board


@app.get("/api/boards/{board_id}")
def get_board(board_id: int, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    _require_board_access(user_id, board_id)
    with get_connection() as conn:
        board = fetch_board(conn, user_id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.patch("/api/boards/{board_id}")
def patch_board(board_id: int, body: UpdateBoardRequest, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    _require_board_access(user_id, board_id)
    with get_connection() as conn:
        updated = update_board(conn, board_id, body.name, body.description)
        conn.commit()
    if not updated:
        raise HTTPException(status_code=404, detail="Board not found")
    return updated


@app.delete("/api/boards/{board_id}")
def remove_board(board_id: int, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    _require_board_access(user_id, board_id)
    with get_connection() as conn:
        remaining = list_boards(conn, user_id)
        if len(remaining) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete your only board")
        deleted = delete_board(conn, board_id)
        conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"ok": True}


@app.patch("/api/boards/{board_id}/reorder-columns")
def reorder_board_columns(board_id: int, body: ReorderColumnsRequest, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    _require_board_access(user_id, board_id)
    with get_connection() as conn:
        ok = reorder_columns(conn, board_id, body.columnIds)
        if not ok:
            raise HTTPException(status_code=400, detail="Column IDs do not match board columns")
        conn.commit()
    return {"ok": True}


# --- Columns ---

class CreateColumnRequest(BaseModel):
    boardId: int
    title: str
    color: str = "#ecad0a"


class RenameColumnRequest(BaseModel):
    title: str | None = None
    color: str | None = None


@app.post("/api/columns")
def add_column(body: CreateColumnRequest, username: str = Depends(verify_session)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Column title cannot be empty")
    user_id = _get_user_id(username)
    _require_board_access(user_id, body.boardId)
    with get_connection() as conn:
        col = create_column(conn, body.boardId, body.title.strip(), body.color)
        conn.commit()
    return col


@app.patch("/api/columns/{column_id}")
def update_column(
    column_id: int,
    body: RenameColumnRequest,
    username: str = Depends(verify_session),
):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT c.id, c.title, c.color, b.user_id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ?",
            (column_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        if int(row["user_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        new_title = body.title if body.title is not None else row["title"]
        new_color = body.color if body.color is not None else row["color"]
        conn.execute(
            "UPDATE columns SET title = ?, color = ? WHERE id = ?",
            (new_title, new_color, column_id),
        )
        conn.commit()
    return {"id": str(column_id), "title": new_title, "color": new_color}


@app.delete("/api/columns/{column_id}")
def remove_column(column_id: int, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT c.board_id, b.user_id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ?",
            (column_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        if int(row["user_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        board_id = int(row["board_id"])
        col_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM columns WHERE board_id = ?",
            (board_id,),
        ).fetchone()["cnt"]
        if col_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the only column in a board")
        deleted = delete_column(conn, column_id)
        conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Column not found")
    return {"ok": True}


# --- Cards ---

class CreateCardRequest(BaseModel):
    columnId: int
    title: str
    details: str | None = None
    priority: str = "medium"
    dueDate: str | None = None


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None
    priority: str | None = None
    dueDate: str | None = None


class MoveCardRequest(BaseModel):
    columnId: int
    position: int


def _verify_column_access(conn, column_id: int, user_id: int) -> None:
    row = conn.execute(
        "SELECT b.user_id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ?",
        (column_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Column not found")
    if int(row["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")


@app.post("/api/cards")
def create_card(body: CreateCardRequest, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        _verify_column_access(conn, body.columnId, user_id)
        row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM cards WHERE column_id = ?",
            (body.columnId,),
        ).fetchone()
        next_pos = int(row["next_pos"])
        priority = body.priority if body.priority in ("low", "medium", "high") else "medium"
        cursor = conn.execute(
            "INSERT INTO cards (column_id, title, details, position, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
            (body.columnId, body.title, body.details or "", next_pos, priority, body.dueDate),
        )
        conn.commit()
        card_id = int(cursor.lastrowid)
    return {
        "id": str(card_id),
        "title": body.title,
        "details": body.details or "",
        "priority": priority,
        "dueDate": body.dueDate,
    }


@app.patch("/api/cards/{card_id}")
def update_card(
    card_id: int,
    body: UpdateCardRequest,
    username: str = Depends(verify_session),
):
    user_id = _get_user_id(username)
    if all(v is None for v in [body.title, body.details, body.priority, body.dueDate]):
        raise HTTPException(status_code=400, detail="No updates provided")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT c.title, c.details, c.priority, c.due_date, col.id as col_id "
            "FROM cards c JOIN columns col ON c.column_id = col.id WHERE c.id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        _verify_column_access(conn, int(row["col_id"]), user_id)
        title = body.title if body.title is not None else row["title"]
        details = body.details if body.details is not None else row["details"]
        priority = body.priority if body.priority is not None else row["priority"]
        if priority not in ("low", "medium", "high"):
            priority = "medium"
        due_date = body.dueDate if body.dueDate is not None else row["due_date"]
        conn.execute(
            "UPDATE cards SET title = ?, details = ?, priority = ?, due_date = ? WHERE id = ?",
            (title, details, priority, due_date, card_id),
        )
        conn.commit()
    return {"id": str(card_id), "title": title, "details": details, "priority": priority, "dueDate": due_date}


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: int, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT c.column_id FROM cards c WHERE c.id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        column_id = int(row["column_id"])
        _verify_column_access(conn, column_id, user_id)
        conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        normalize_positions(conn, column_id)
        conn.commit()
    return {"ok": True}


@app.patch("/api/cards/{card_id}/move")
def move_card(
    card_id: int,
    body: MoveCardRequest,
    username: str = Depends(verify_session),
):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT column_id FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        source_column_id = int(row["column_id"])
        _verify_column_access(conn, source_column_id, user_id)
        _verify_column_access(conn, body.columnId, user_id)

        source_ids = get_column_cards(conn, source_column_id)
        if card_id in source_ids:
            source_ids.remove(card_id)

        if source_column_id == body.columnId:
            target_ids = source_ids
        else:
            reorder_column(conn, source_column_id, source_ids)
            target_ids = get_column_cards(conn, body.columnId)

        insert_at = max(0, min(body.position, len(target_ids)))
        target_ids.insert(insert_at, card_id)
        reorder_column(conn, body.columnId, target_ids)
        conn.commit()
    return {"ok": True}


# --- AI ---

@app.get("/api/ai/ping")
def ai_ping(username: str = Depends(verify_session)):
    _ = username
    text = call_claude([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
    return {"response": text}


class ChatRequest(BaseModel):
    messages: list[dict]
    board: dict
    boardId: int | None = None


@app.post("/api/ai/chat")
def ai_chat(body: ChatRequest, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    board_id = body.boardId

    if board_id is not None:
        _require_board_access(user_id, board_id)

    ai_response: AIResponse = chat_with_claude(body.messages, body.board)

    if ai_response.kanban_update:
        cols = [
            {"id": col.id, "cards": [{"id": c.id, "title": c.title, "details": c.details} for c in col.cards]}
            for col in ai_response.kanban_update.columns
        ]
        with get_connection() as conn:
            apply_kanban_update(conn, cols)
            conn.commit()
            board = fetch_board(conn, user_id, board_id)
    else:
        with get_connection() as conn:
            board = fetch_board(conn, user_id, board_id)

    return {"message": ai_response.message, "board": board}


# --- Backward-compat: single board endpoint ---

@app.get("/api/board")
def get_default_board(username: str = Depends(verify_session)):
    """Returns the user's first board (or creates one). Kept for backward compatibility."""
    user_id = _get_user_id(username)
    with get_connection() as conn:
        return fetch_board(conn, user_id)


# --- Static files (Next.js export) ---
_static_dir = Path(__file__).parent / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
