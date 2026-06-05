import os
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


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id        INTEGER PRIMARY KEY AUTOINCREMENT,
              username  TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS boards (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id    INTEGER NOT NULL REFERENCES users(id),
              name       TEXT NOT NULL DEFAULT 'My Board'
            );

            CREATE TABLE IF NOT EXISTS columns (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              board_id   INTEGER NOT NULL REFERENCES boards(id),
              title      TEXT NOT NULL,
              position   INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cards (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              column_id  INTEGER NOT NULL REFERENCES columns(id),
              title      TEXT NOT NULL,
              details    TEXT NOT NULL DEFAULT '',
              position   INTEGER NOT NULL
            );
            """
        )
        user_id = ensure_user(conn, "user")
        ensure_board(conn, user_id)
        conn.commit()


def ensure_user(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])
    cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
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
    for index, title in enumerate(DEFAULT_COLUMNS):
        conn.execute(
            "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
            (board_id, title, index),
        )
    return board_id


def fetch_board(conn: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    board_id = ensure_board(conn, user_id)
    columns_rows = conn.execute(
        "SELECT id, title, position FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    column_card_ids: dict[int, list[str]] = {
        int(row["id"]): [] for row in columns_rows
    }
    cards_map: dict[str, dict[str, str]] = {}

    cards_rows = conn.execute(
        """
        SELECT id, column_id, title, details, position
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
        }
        column_card_ids[int(row["column_id"])].append(card_id)

    columns = [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "cardIds": column_card_ids[int(row["id"])],
        }
        for row in columns_rows
    ]

    return {"columns": columns, "cards": cards_map}


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
