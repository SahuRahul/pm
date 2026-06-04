# Database schema

This schema is designed for a single board per user (MVP). It supports ordered columns and cards, and maps cleanly to the frontend `BoardData` shape.

## Tables (SQLite DDL)

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
  position   INTEGER NOT NULL
);

CREATE TABLE cards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id  INTEGER NOT NULL REFERENCES columns(id),
  title      TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL
);
```

## Relationships

- `users` -> `boards` is one-to-many (MVP uses one board per user).
- `boards` -> `columns` is one-to-many.
- `columns` -> `cards` is one-to-many.
- Ordering is handled by `position` on `columns` and `cards`.

## Mapping to `BoardData`

Frontend shape:

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; title: string; cardIds: string[] };
type BoardData = { columns: Column[]; cards: Record<string, Card> };
```

Backend mapping:

- Each row in `columns` becomes a `Column` (ordered by `position`).
- Each row in `cards` becomes a `Card` (ordered by `position` within its column).
- `Column.cardIds` is derived by selecting cards by `column_id`, ordered by `position`.
- The `cards` map is keyed by stringified `cards.id` values.

## Notes

- Integer IDs are stored in SQLite; the API will return them as strings to match the current frontend shape.
- This keeps ordering stable and supports drag-and-drop moves by updating `position` values.
