"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { apiUrl } from "@/lib/api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

// Strip col-/card- prefix to get the numeric DB id for API calls
const stripId = (prefixedId: string): number =>
  Number(prefixedId.replace(/^(col-|card-)/, ""));

// Add col-/card- prefixes to prevent id collision between columns and cards
const normalizeBoard = (data: BoardData): BoardData => ({
  columns: data.columns.map((col) => ({
    ...col,
    id: `col-${col.id}`,
    cardIds: col.cardIds.map((id) => `card-${id}`),
  })),
  cards: Object.fromEntries(
    Object.entries(data.cards).map(([id, card]) => [
      `card-${id}`,
      { ...card, id: `card-${id}` },
    ])
  ),
});

type KanbanBoardProps = {
  onLogout?: () => void;
  initialBoard?: BoardData;
  useApi?: boolean;
};

export const KanbanBoard = ({
  onLogout,
  initialBoard,
  useApi = true,
}: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(initialBoard ?? null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(useApi && !initialBoard);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (!useApi || initialBoard) {
      return;
    }

    let isActive = true;

    const loadBoard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl("/api/board"), {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load board.");
        }
        const data = (await response.json()) as BoardData;
        if (isActive) {
          setBoard(normalizeBoard(data));
        }
      } catch {
        if (isActive) {
          setError("Unable to load board.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadBoard();

    return () => {
      isActive = false;
    };
  }, [useApi, initialBoard]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id || !board) {
      return;
    }

    const activeId = active.id as string;
    const nextColumns = moveCard(board.columns, activeId, over.id as string);

    setBoard((prev) => (prev ? { ...prev, columns: nextColumns } : prev));

    if (!useApi) {
      return;
    }

    const targetColumn = nextColumns.find((column) =>
      column.cardIds.includes(activeId)
    );
    if (!targetColumn) {
      return;
    }

    const position = targetColumn.cardIds.indexOf(activeId);
    const columnId = stripId(targetColumn.id);
    if (!Number.isFinite(columnId)) {
      setError("Unable to move card.");
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/cards/${stripId(activeId)}/move`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnId, position }),
      });
      if (!response.ok) {
        setError("Unable to move card.");
      }
    } catch {
      setError("Unable to move card.");
    }
  };

  const handleRenameColumn = async (columnId: string, title: string) => {
    if (!board) {
      return;
    }
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((column) =>
              column.id === columnId ? { ...column, title } : column
            ),
          }
        : prev
    );

    if (!useApi) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/columns/${stripId(columnId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        setError("Unable to rename column.");
      }
    } catch {
      setError("Unable to rename column.");
    }
  };

  const handleAddCard = async (columnId: string, title: string, details: string) => {
    if (!board) {
      return;
    }

    if (!useApi) {
      const id = createId("card");
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: {
                ...prev.cards,
                [id]: { id, title, details: details || "No details yet." },
              },
              columns: prev.columns.map((column) =>
                column.id === columnId
                  ? { ...column, cardIds: [...column.cardIds, id] }
                  : column
              ),
            }
          : prev
      );
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/cards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnId: stripId(columnId), title, details }),
      });
      if (!response.ok) {
        setError("Unable to add card.");
        return;
      }
      const card = (await response.json()) as {
        id: string;
        title: string;
        details: string;
      };
      const prefixedCardId = `card-${card.id}`;
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: {
                ...prev.cards,
                [prefixedCardId]: {
                  id: prefixedCardId,
                  title: card.title,
                  details: card.details,
                },
              },
              columns: prev.columns.map((column) =>
                column.id === columnId
                  ? { ...column, cardIds: [...column.cardIds, prefixedCardId] }
                  : column
              ),
            }
          : prev
      );
    } catch {
      setError("Unable to add card.");
    }
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    if (!board) {
      return;
    }

    if (!useApi) {
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: Object.fromEntries(
                Object.entries(prev.cards).filter(([id]) => id !== cardId)
              ),
              columns: prev.columns.map((column) =>
                column.id === columnId
                  ? {
                      ...column,
                      cardIds: column.cardIds.filter((id) => id !== cardId),
                    }
                  : column
              ),
            }
          : prev
      );
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/cards/${stripId(cardId)}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        setError("Unable to delete card.");
        return;
      }
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: Object.fromEntries(
                Object.entries(prev.cards).filter(([id]) => id !== cardId)
              ),
              columns: prev.columns.map((column) =>
                column.id === columnId
                  ? {
                      ...column,
                      cardIds: column.cardIds.filter((id) => id !== cardId),
                    }
                  : column
              ),
            }
          : prev
      );
    } catch {
      setError("Unable to delete card.");
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-[720px] items-center justify-center px-6 py-16 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board
        </main>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-[720px] items-center justify-center px-6 py-16 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Board unavailable
        </main>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-[rgba(236,173,10,0.45)] bg-[rgba(236,173,10,0.12)] px-6 py-4 text-sm text-[var(--navy-dark)]">
            {error}
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
