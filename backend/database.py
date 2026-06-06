import hashlib
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Any

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def get_db_path() -> str:
    return os.getenv("DB_PATH", "/data/kanban.db")


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str) -> str:
    salt = secrets.token_hex(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}:{key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":", 1)
    except ValueError:
        return False
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return secrets.compare_digest(key.hex(), key_hex)


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              username      TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL DEFAULT '',
              email         TEXT,
              role          TEXT NOT NULL DEFAULT 'user',
              created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS boards (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name        TEXT NOT NULL DEFAULT 'My Board',
              description TEXT NOT NULL DEFAULT '',
              created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS columns (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
              title      TEXT NOT NULL,
              position   INTEGER NOT NULL,
              color      TEXT NOT NULL DEFAULT '#ecad0a'
            );

            CREATE TABLE IF NOT EXISTS cards (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
              title       TEXT NOT NULL,
              details     TEXT NOT NULL DEFAULT '',
              position    INTEGER NOT NULL,
              priority    TEXT NOT NULL DEFAULT 'medium',
              due_date    TEXT,
              created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        _run_migrations(conn)
        _seed_default_user(conn)
        conn.commit()


def _run_migrations(conn: sqlite3.Connection) -> None:
    """Add any missing columns to existing tables (idempotent)."""
    existing_user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    if "password_hash" not in existing_user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    if "email" not in existing_user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "role" not in existing_user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
    if "created_at" not in existing_user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))")

    existing_board_cols = {row[1] for row in conn.execute("PRAGMA table_info(boards)")}
    if "description" not in existing_board_cols:
        conn.execute("ALTER TABLE boards ADD COLUMN description TEXT NOT NULL DEFAULT ''")
    if "created_at" not in existing_board_cols:
        conn.execute("ALTER TABLE boards ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))")

    existing_col_cols = {row[1] for row in conn.execute("PRAGMA table_info(columns)")}
    if "color" not in existing_col_cols:
        conn.execute("ALTER TABLE columns ADD COLUMN color TEXT NOT NULL DEFAULT '#ecad0a'")

    existing_card_cols = {row[1] for row in conn.execute("PRAGMA table_info(cards)")}
    if "priority" not in existing_card_cols:
        conn.execute("ALTER TABLE cards ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'")
    if "due_date" not in existing_card_cols:
        conn.execute("ALTER TABLE cards ADD COLUMN due_date TEXT")
    if "created_at" not in existing_card_cols:
        conn.execute("ALTER TABLE cards ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))")


def _seed_default_user(conn: sqlite3.Connection) -> None:
    """Ensure the default 'user' account exists with a hashed password."""
    row = conn.execute("SELECT id, password_hash FROM users WHERE username = 'user'").fetchone()
    if not row:
        pw_hash = hash_password("password")
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("user", pw_hash, "admin"),
        )
        user_id = int(cursor.lastrowid)
        ensure_board(conn, user_id)
    elif not row["password_hash"]:
        pw_hash = hash_password("password")
        conn.execute("UPDATE users SET password_hash = ? WHERE username = 'user'", (pw_hash,))
        user_id = int(row["id"])
        ensure_board(conn, user_id)


# --- User management ---

def create_user(conn: sqlite3.Connection, username: str, password: str, email: str | None = None) -> int:
    pw_hash = hash_password(password)
    cursor = conn.execute(
        "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
        (username, pw_hash, email),
    )
    return int(cursor.lastrowid)


def authenticate_user(conn: sqlite3.Connection, username: str, password: str) -> dict | None:
    row = conn.execute(
        "SELECT id, username, password_hash, email, role FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if not row:
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return {"id": int(row["id"]), "username": row["username"], "email": row["email"], "role": row["role"]}


def get_user_by_username(conn: sqlite3.Connection, username: str) -> dict | None:
    row = conn.execute(
        "SELECT id, username, email, role, created_at FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if not row:
        return None
    return dict(row)


def list_users(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT id, username, email, role, created_at FROM users ORDER BY created_at").fetchall()
    return [dict(r) for r in rows]


def delete_user(conn: sqlite3.Connection, user_id: int) -> bool:
    result = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return result.rowcount > 0


# --- Board management ---

def ensure_user(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])
    pw_hash = hash_password("password")
    cursor = conn.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, pw_hash),
    )
    return int(cursor.lastrowid)


def ensure_board(conn: sqlite3.Connection, user_id: int) -> int:
    row = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return int(row["id"])
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name) VALUES (?, ?)",
        (user_id, "My Board"),
    )
    board_id = int(cursor.lastrowid)
    _create_default_columns(conn, board_id)
    return board_id


def _create_default_columns(conn: sqlite3.Connection, board_id: int) -> None:
    for index, title in enumerate(DEFAULT_COLUMNS):
        conn.execute(
            "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
            (board_id, title, index),
        )


def create_board(conn: sqlite3.Connection, user_id: int, name: str, description: str = "") -> dict:
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name, description) VALUES (?, ?, ?)",
        (user_id, name, description),
    )
    board_id = int(cursor.lastrowid)
    _create_default_columns(conn, board_id)
    return {"id": str(board_id), "name": name, "description": description}


def list_boards(conn: sqlite3.Connection, user_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT id, name, description, created_at FROM boards WHERE user_id = ? ORDER BY created_at",
        (user_id,),
    ).fetchall()
    result = []
    for row in rows:
        board_id = int(row["id"])
        card_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)",
            (board_id,),
        ).fetchone()["cnt"]
        col_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM columns WHERE board_id = ?",
            (board_id,),
        ).fetchone()["cnt"]
        result.append({
            "id": str(board_id),
            "name": row["name"],
            "description": row["description"],
            "createdAt": row["created_at"],
            "cardCount": card_count,
            "columnCount": col_count,
        })
    return result


def get_board_owner(conn: sqlite3.Connection, board_id: int) -> int | None:
    row = conn.execute("SELECT user_id FROM boards WHERE id = ?", (board_id,)).fetchone()
    return int(row["user_id"]) if row else None


def update_board(conn: sqlite3.Connection, board_id: int, name: str | None = None, description: str | None = None) -> dict | None:
    row = conn.execute("SELECT id, name, description FROM boards WHERE id = ?", (board_id,)).fetchone()
    if not row:
        return None
    new_name = name if name is not None else row["name"]
    new_desc = description if description is not None else row["description"]
    conn.execute(
        "UPDATE boards SET name = ?, description = ? WHERE id = ?",
        (new_name, new_desc, board_id),
    )
    return {"id": str(board_id), "name": new_name, "description": new_desc}


def delete_board(conn: sqlite3.Connection, board_id: int) -> bool:
    result = conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
    return result.rowcount > 0


# --- Column management ---

def create_column(conn: sqlite3.Connection, board_id: int, title: str, color: str = "#ecad0a") -> dict:
    row = conn.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM columns WHERE board_id = ?",
        (board_id,),
    ).fetchone()
    next_pos = int(row["next_pos"])
    cursor = conn.execute(
        "INSERT INTO columns (board_id, title, position, color) VALUES (?, ?, ?, ?)",
        (board_id, title, next_pos, color),
    )
    return {"id": str(int(cursor.lastrowid)), "title": title, "color": color, "cardIds": []}


def delete_column(conn: sqlite3.Connection, column_id: int) -> bool:
    row = conn.execute("SELECT board_id FROM columns WHERE id = ?", (column_id,)).fetchone()
    if not row:
        return False
    board_id = int(row["board_id"])
    conn.execute("DELETE FROM columns WHERE id = ?", (column_id,))
    _renumber_columns(conn, board_id)
    return True


def _renumber_columns(conn: sqlite3.Connection, board_id: int) -> None:
    rows = conn.execute(
        "SELECT id FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()
    for i, row in enumerate(rows):
        conn.execute("UPDATE columns SET position = ? WHERE id = ?", (i, int(row["id"])))


def reorder_columns(conn: sqlite3.Connection, board_id: int, column_ids: list[int]) -> bool:
    existing = {
        int(r["id"])
        for r in conn.execute("SELECT id FROM columns WHERE board_id = ?", (board_id,)).fetchall()
    }
    if set(column_ids) != existing:
        return False
    for i, col_id in enumerate(column_ids):
        conn.execute("UPDATE columns SET position = ? WHERE id = ?", (i, col_id))
    return True


# --- Board fetch ---

def fetch_board(conn: sqlite3.Connection, user_id: int, board_id: int | None = None) -> dict[str, Any]:
    if board_id is None:
        board_id = ensure_board(conn, user_id)
    else:
        row = conn.execute("SELECT id, name, description FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)).fetchone()
        if not row:
            return {}

    row = conn.execute("SELECT id, name, description FROM boards WHERE id = ?", (board_id,)).fetchone()
    board_name = row["name"]
    board_description = row["description"]

    columns_rows = conn.execute(
        "SELECT id, title, position, color FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    column_card_ids: dict[int, list[str]] = {int(row["id"]): [] for row in columns_rows}
    cards_map: dict[str, dict[str, Any]] = {}

    cards_rows = conn.execute(
        """
        SELECT id, column_id, title, details, position, priority, due_date
        FROM cards
        WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)
        ORDER BY position
        """,
        (board_id,),
    ).fetchall()

    for row in cards_rows:
        card_id = str(row["id"])
        cards_map[card_id] = {
            "id": card_id,
            "title": row["title"],
            "details": row["details"],
            "priority": row["priority"],
            "dueDate": row["due_date"],
        }
        column_card_ids[int(row["column_id"])].append(card_id)

    columns = [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "color": row["color"],
            "cardIds": column_card_ids[int(row["id"])],
        }
        for row in columns_rows
    ]

    return {
        "id": str(board_id),
        "name": board_name,
        "description": board_description,
        "columns": columns,
        "cards": cards_map,
    }


# --- Card helpers ---

def get_column_cards(conn: sqlite3.Connection, column_id: int) -> list[int]:
    rows = conn.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
        (column_id,),
    ).fetchall()
    return [int(row["id"]) for row in rows]


def reorder_column(conn: sqlite3.Connection, column_id: int, ordered_ids: list[int]) -> None:
    for index, card_id in enumerate(ordered_ids):
        conn.execute(
            "UPDATE cards SET position = ?, column_id = ? WHERE id = ?",
            (index, column_id, card_id),
        )


def normalize_positions(conn: sqlite3.Connection, column_id: int) -> None:
    ids = get_column_cards(conn, column_id)
    reorder_column(conn, column_id, ids)


def apply_kanban_update(conn: sqlite3.Connection, columns: list[dict]) -> None:
    """
    Apply a full-replacement update to a set of columns.
    Each entry: {"id": str, "cards": [{"id"?: str, "title": str, "details": str, ...}]}
    """
    for col in columns:
        try:
            column_id = int(col["id"])
        except (ValueError, TypeError):
            continue

        if not conn.execute("SELECT 1 FROM columns WHERE id = ?", (column_id,)).fetchone():
            continue

        incoming = col["cards"]
        existing_ids = set(get_column_cards(conn, column_id))
        incoming_ids = {int(c["id"]) for c in incoming if c.get("id")}

        for card_id in existing_ids - incoming_ids:
            conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))

        for position, card in enumerate(incoming):
            title = card["title"]
            details = card.get("details", "")
            priority = card.get("priority", "medium")
            due_date = card.get("due_date") or card.get("dueDate")
            if card.get("id"):
                card_id = int(card["id"])
                conn.execute(
                    "UPDATE cards SET title = ?, details = ?, position = ?, column_id = ?, priority = ?, due_date = ? WHERE id = ?",
                    (title, details, position, column_id, priority, due_date, card_id),
                )
            else:
                conn.execute(
                    "INSERT INTO cards (column_id, title, details, position, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
                    (column_id, title, details, position, priority, due_date),
                )
