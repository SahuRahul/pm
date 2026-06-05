from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ai import AIResponse, KanbanUpdate, call_claude, chat_with_claude
from auth import VALID_PASSWORD, VALID_USERNAME, clear_session, create_session, verify_session
from database import (
    apply_kanban_update,
    fetch_board,
    get_column_cards,
    get_connection,
    init_db,
    normalize_positions,
    reorder_column,
)

app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    if body.username != VALID_USERNAME or body.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    create_session(response, body.username)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(verify_session)):
    return {"username": username}


# --- Board data ---

class RenameColumnRequest(BaseModel):
    title: str


class CreateCardRequest(BaseModel):
    columnId: int
    title: str
    details: str | None = None


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None


class MoveCardRequest(BaseModel):
    columnId: int
    position: int


def _get_user_id(username: str) -> int:
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
            conn.commit()
            return int(cursor.lastrowid)
        return int(row["id"])


@app.get("/api/board")
def get_board(username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    with get_connection() as conn:
        return fetch_board(conn, user_id)


@app.patch("/api/columns/{column_id}")
def rename_column(
    column_id: int,
    body: RenameColumnRequest,
    username: str = Depends(verify_session),
):
    _ = username
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM columns WHERE id = ?",
            (column_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        conn.execute("UPDATE columns SET title = ? WHERE id = ?", (body.title, column_id))
        conn.commit()
    return {"id": str(column_id), "title": body.title}


@app.post("/api/cards")
def create_card(body: CreateCardRequest, username: str = Depends(verify_session)):
    _ = username
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM columns WHERE id = ?",
            (body.columnId,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM cards WHERE column_id = ?",
            (body.columnId,),
        ).fetchone()
        next_pos = int(row["next_pos"])
        cursor = conn.execute(
            "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
            (body.columnId, body.title, body.details or "", next_pos),
        )
        conn.commit()
        card_id = int(cursor.lastrowid)
    return {"id": str(card_id), "title": body.title, "details": body.details or ""}


@app.patch("/api/cards/{card_id}")
def update_card(
    card_id: int,
    body: UpdateCardRequest,
    username: str = Depends(verify_session),
):
    _ = username
    if body.title is None and body.details is None:
        raise HTTPException(status_code=400, detail="No updates provided")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT title, details FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        title = body.title if body.title is not None else row["title"]
        details = body.details if body.details is not None else row["details"]
        conn.execute(
            "UPDATE cards SET title = ?, details = ? WHERE id = ?",
            (title, details, card_id),
        )
        conn.commit()
    return {"id": str(card_id), "title": title, "details": details}


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: int, username: str = Depends(verify_session)):
    _ = username
    with get_connection() as conn:
        row = conn.execute(
            "SELECT column_id FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        column_id = int(row["column_id"])
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
    _ = username
    with get_connection() as conn:
        row = conn.execute(
            "SELECT column_id FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        column_row = conn.execute(
            "SELECT id FROM columns WHERE id = ?",
            (body.columnId,),
        ).fetchone()
        if not column_row:
            raise HTTPException(status_code=404, detail="Column not found")
        source_column_id = int(row["column_id"])
        target_column_id = int(body.columnId)

        source_ids = get_column_cards(conn, source_column_id)
        if card_id in source_ids:
            source_ids.remove(card_id)

        if source_column_id == target_column_id:
            target_ids = source_ids
        else:
            reorder_column(conn, source_column_id, source_ids)
            target_ids = get_column_cards(conn, target_column_id)

        insert_at = max(0, min(body.position, len(target_ids)))
        target_ids.insert(insert_at, card_id)
        reorder_column(conn, target_column_id, target_ids)

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


@app.post("/api/ai/chat")
def ai_chat(body: ChatRequest, username: str = Depends(verify_session)):
    user_id = _get_user_id(username)
    ai_response: AIResponse = chat_with_claude(body.messages, body.board)

    if ai_response.kanban_update:
        cols = [
            {"id": col.id, "cards": [{"id": c.id, "title": c.title, "details": c.details} for c in col.cards]}
            for col in ai_response.kanban_update.columns
        ]
        with get_connection() as conn:
            apply_kanban_update(conn, cols)
            conn.commit()
            board = fetch_board(conn, user_id)
    else:
        with get_connection() as conn:
            board = fetch_board(conn, user_id)

    return {"message": ai_response.message, "board": board}


# --- Static files (Next.js export) ---
# Routes defined above take priority over the static mount.
_static_dir = Path(__file__).parent / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
