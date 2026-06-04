# Frontend — Codebase Overview

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 with CSS custom properties (no config file needed)
- **Drag and drop**: @dnd-kit/core + @dnd-kit/sortable
- **Unit tests**: Vitest + @testing-library/react + @testing-library/user-event
- **E2E tests**: Playwright

## Project structure

```
src/
  app/
    globals.css       # CSS variables + Tailwind import
    layout.tsx        # Root layout with font loading
    page.tsx          # Root page — renders <KanbanBoard />
  components/
    KanbanBoard.tsx   # Top-level board; owns all state; renders columns via DndContext
    KanbanColumn.tsx  # Droppable column; renders its cards via SortableContext
    KanbanCard.tsx    # Sortable draggable card with title, details, delete button
    KanbanCardPreview.tsx  # Drag overlay clone (rendered by DragOverlay in KanbanBoard)
    NewCardForm.tsx   # Inline expand/collapse form for adding a card to a column
  lib/
    kanban.ts         # Types (Card, Column, BoardData), initialData, moveCard logic, createId
  test/
    setup.ts          # Vitest global setup (@testing-library/jest-dom matchers)
    vitest.d.ts       # Type augmentation for custom matchers
```

## Data model (frontend)

```ts
type Card     = { id: string; title: string; details: string }
type Column   = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

Cards are stored in a flat map keyed by id. Columns hold an ordered array of card ids. This is the canonical shape to use in the API and database.

## State management

All board state lives in a single `useState<BoardData>` in `KanbanBoard`. There is no global store or context — props are passed down to columns and cards.

When the backend is wired in (Part 7), API calls should replace `initialData` and mutations should POST/PATCH to the backend.

## CSS variables

Defined in `globals.css` and used via `var(--name)` throughout Tailwind classes:

| Variable            | Value     | Usage                          |
|---------------------|-----------|--------------------------------|
| `--accent-yellow`   | `#ecad0a` | Accent lines, column indicator |
| `--primary-blue`    | `#209dd7` | Links, key sections            |
| `--secondary-purple`| `#753991` | Submit buttons, actions        |
| `--navy-dark`       | `#032147` | Main headings, body text       |
| `--gray-text`       | `#888888` | Supporting text, labels        |
| `--surface`         | `#f7f8fb` | Page background                |
| `--stroke`          | rgba(...) | Borders                        |
| `--shadow`          | ...       | Box shadows                    |

## Tests

- **Unit / component tests**: `npm run test:unit` (Vitest + jsdom)
  - `src/lib/kanban.test.ts` — pure logic (moveCard, createId)
  - `src/components/KanbanBoard.test.tsx` — render, rename column, add/delete card
- **E2E tests**: `npm run test:e2e` (Playwright, requires a running dev server)
  - `tests/kanban.spec.ts`

## Key conventions

- All components are `"use client"` where they use hooks or event handlers.
- `data-testid` attributes follow the pattern `column-{id}` and `card-{id}`.
- IDs are generated with `createId(prefix)` from `lib/kanban.ts` using `crypto.randomUUID()`.
- The board has exactly 5 columns. Column ids are stable (`col-backlog`, `col-discovery`, `col-progress`, `col-review`, `col-done`).
- No global state library — keep it simple.
- Tailwind classes only; no CSS modules or styled-components.
