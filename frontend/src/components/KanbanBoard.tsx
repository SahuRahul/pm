"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { BoardSelector } from "@/components/BoardSelector";
import { CardDetailModal } from "@/components/CardDetailModal";
import { SearchFilter, applyFilter, emptyFilter, type FilterState } from "@/components/SearchFilter";
import {
  assignLabel,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  getBoard,
  listBoards,
  listLabels,
  moveCardApi,
  reorderColumns,
  unassignLabel,
  updateCard,
  updateColumn,
} from "@/lib/api";
import {
  createId,
  moveCard,
  type BoardData,
  type BoardSummary,
  type Card,
  type Label,
  type Priority,
} from "@/lib/kanban";

const stripId = (prefixedId: string): number =>
  Number(prefixedId.replace(/^(col-|card-)/, ""));

const denormalizeBoard = (data: BoardData): BoardData => ({
  ...data,
  columns: data.columns.map((col) => ({
    ...col,
    id: col.id.replace(/^col-/, ""),
    cardIds: col.cardIds.map((id) => id.replace(/^card-/, "")),
  })),
  cards: Object.fromEntries(
    Object.entries(data.cards).map(([id, card]) => [
      id.replace(/^card-/, ""),
      { ...card, id: card.id.replace(/^card-/, "") },
    ])
  ),
});

const normalizeBoard = (data: BoardData): BoardData => ({
  ...data,
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
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardData | null>(initialBoard ?? null);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  const [isLoading, setIsLoading] = useState(useApi && !initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadBoard = useCallback(async (boardId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBoard(boardId);
      setBoard(normalizeBoard(data));
      setActiveBoardId(boardId);
    } catch {
      setError("Unable to load board.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!useApi || initialBoard) return;
    let active = true;
    const init = async () => {
      setIsLoading(true);
      try {
        const [boardList, labels] = await Promise.all([listBoards(), listLabels()]);
        if (!active) return;
        setBoards(boardList);
        setAllLabels(labels);
        if (boardList.length > 0) {
          const data = await getBoard(boardList[0].id);
          if (!active) return;
          setBoard(normalizeBoard(data));
          setActiveBoardId(boardList[0].id);
        }
      } catch {
        if (active) setError("Unable to load boards.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, [useApi, initialBoard, loadBoard]);

  const handleBoardSelect = async (boardId: string) => {
    setFilter(emptyFilter);
    await loadBoard(boardId);
  };

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const denormalizedBoard = useMemo(
    () => (sidebarOpen && board ? denormalizeBoard(board) : null),
    [sidebarOpen, board]
  );

  // Compute filtered card IDs per column
  const filteredCardIds = useMemo(() => {
    if (!board) return {};
    const result: Record<string, string[]> = {};
    for (const col of board.columns) {
      result[col.id] = applyFilter(col.cardIds, board.cards, filter);
    }
    return result;
  }, [board, filter]);

  const totalCards = useMemo(() => Object.keys(cardsById).length, [cardsById]);
  const visibleCards = useMemo(
    () => Object.values(filteredCardIds).reduce((sum, ids) => sum + ids.length, 0),
    [filteredCardIds]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (board?.columns.some((c) => c.id === id)) {
      setActiveColumnId(id);
    } else {
      setActiveCardId(id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    setActiveColumnId(null);
    if (!over || active.id === over.id || !board) return;

    const activeId = active.id as string;

    // Column reorder
    if (board.columns.some((c) => c.id === activeId)) {
      const oldIndex = board.columns.findIndex((c) => c.id === activeId);
      const newIndex = board.columns.findIndex((c) => c.id === (over.id as string));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newColumns = arrayMove(board.columns, oldIndex, newIndex);
      setBoard((prev) => (prev ? { ...prev, columns: newColumns } : prev));
      if (useApi && activeBoardId) {
        try {
          await reorderColumns(activeBoardId, newColumns.map((c) => stripId(c.id)));
          setError(null);
        } catch {
          setBoard((prev) => (prev ? { ...prev, columns: board.columns } : prev));
          setError("Unable to reorder columns.");
        }
      }
      return;
    }

    const prevColumns = board.columns;
    const nextColumns = moveCard(board.columns, activeId, over.id as string);
    setBoard((prev) => (prev ? { ...prev, columns: nextColumns } : prev));

    if (!useApi) return;

    const targetColumn = nextColumns.find((c) => c.cardIds.includes(activeId));
    if (!targetColumn) return;

    const position = targetColumn.cardIds.indexOf(activeId);
    const columnId = stripId(targetColumn.id);
    if (!Number.isFinite(columnId)) {
      setBoard((prev) => (prev ? { ...prev, columns: prevColumns } : prev));
      setError("Unable to move card.");
      return;
    }

    try {
      await moveCardApi(String(stripId(activeId)), columnId, position);
      setError(null);
    } catch {
      setBoard((prev) => (prev ? { ...prev, columns: prevColumns } : prev));
      setError("Unable to move card.");
    }
  };

  const handleRenameColumn = async (columnId: string, title: string) => {
    if (!board) return;
    setBoard((prev) =>
      prev ? { ...prev, columns: prev.columns.map((c) => c.id === columnId ? { ...c, title } : c) } : prev
    );
    if (!useApi) return;
    try {
      await updateColumn(String(stripId(columnId)), { title });
      setError(null);
    } catch {
      setError("Unable to rename column.");
    }
  };

  const handleAddColumn = async () => {
    if (!board || !activeBoardId) return;
    if (!useApi) {
      const id = createId("col");
      setBoard((prev) =>
        prev ? { ...prev, columns: [...prev.columns, { id, title: "New Column", color: "#ecad0a", cardIds: [] }] } : prev
      );
      return;
    }
    try {
      const col = await createColumn(parseInt(activeBoardId), "New Column");
      setBoard((prev) =>
        prev
          ? { ...prev, columns: [...prev.columns, { id: `col-${col.id}`, title: col.title, color: col.color, cardIds: [] }] }
          : prev
      );
      setError(null);
    } catch {
      setError("Unable to add column.");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!board) return;
    if (!confirm("Delete this column and all its cards?")) return;
    const prevBoard = board;
    setBoard((prev) =>
      prev ? { ...prev, columns: prev.columns.filter((c) => c.id !== columnId) } : prev
    );
    if (!useApi) return;
    try {
      await deleteColumn(String(stripId(columnId)));
      setError(null);
    } catch (err) {
      setBoard(prevBoard);
      setError((err as Error).message || "Unable to delete column.");
    }
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string,
    priority: Priority,
    dueDate: string | null
  ) => {
    if (!board) return;
    if (!useApi) {
      const id = createId("card");
      const card: Card = { id, title, details: details || "", priority, dueDate, labels: [] };
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: { ...prev.cards, [id]: card },
              columns: prev.columns.map((c) =>
                c.id === columnId ? { ...c, cardIds: [...c.cardIds, id] } : c
              ),
            }
          : prev
      );
      return;
    }
    try {
      const card = await createCard(stripId(columnId), title, details, priority, dueDate ?? undefined);
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
                  priority: card.priority,
                  dueDate: card.dueDate,
                  labels: [],
                },
              },
              columns: prev.columns.map((c) =>
                c.id === columnId ? { ...c, cardIds: [...c.cardIds, prefixedCardId] } : c
              ),
            }
          : prev
      );
      setError(null);
    } catch {
      setError("Unable to add card.");
    }
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    if (!board) return;
    if (modalCardId === cardId) setModalCardId(null);
    const prevBoard = board;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: Object.fromEntries(Object.entries(prev.cards).filter(([id]) => id !== cardId)),
            columns: prev.columns.map((c) =>
              c.id === columnId ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) } : c
            ),
          }
        : prev
    );
    if (!useApi) return;
    try {
      await deleteCard(String(stripId(cardId)));
      setError(null);
    } catch {
      setBoard(prevBoard);
      setError("Unable to delete card.");
    }
  };

  const handleCardUpdate = async (cardId: string, updates: Partial<Card>) => {
    if (!board) return;
    // Optimistic update
    setBoard((prev) =>
      prev
        ? { ...prev, cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId], ...updates } } }
        : prev
    );
    if (!useApi || !updates) return;
    // Only send scalar fields to the API (labels have their own endpoints)
    const { labels: _labels, ...scalarUpdates } = updates;
    if (Object.keys(scalarUpdates).length === 0) return;
    try {
      await updateCard(String(stripId(cardId)), {
        title: scalarUpdates.title,
        details: scalarUpdates.details,
        priority: scalarUpdates.priority,
        dueDate: scalarUpdates.dueDate,
      });
      setError(null);
    } catch {
      setError("Unable to update card.");
    }
  };

  const modalCard = modalCardId ? cardsById[modalCardId] : null;

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) return <FullscreenMessage text="Loading board" />;
  if (!board) return <FullscreenMessage text="Board unavailable" />;

  return (
    <div className="relative overflow-hidden">
      <BgGradients />

      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-6 pb-16 pt-12">
        {/* Header */}
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project Management
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                {board.name}
              </h1>
              {board.description && (
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                  {board.description}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-4">
              {useApi && boards.length > 0 && activeBoardId && (
                <BoardSelector
                  boards={boards}
                  activeBoardId={activeBoardId}
                  onSelect={handleBoardSelect}
                  onBoardsChange={setBoards}
                />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--accent-yellow)] hover:text-[var(--accent-yellow)]"
                >
                  + Column
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen((o) => !o)}
                  className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  {sidebarOpen ? "Close AI" : "AI Assistant"}
                </button>
                {useApi && (
                  <Link
                    href="/profile"
                    className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  >
                    Profile
                  </Link>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                  >
                    Log out
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color || "var(--accent-yellow)" }} />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {/* Search/filter bar */}
        <SearchFilter
          filter={filter}
          onChange={setFilter}
          labels={allLabels}
          totalCards={totalCards}
          visibleCards={visibleCards}
        />

        {error && (
          <div className="rounded-2xl border border-[rgba(236,173,10,0.45)] bg-[rgba(236,173,10,0.12)] px-6 py-4 text-sm text-[var(--navy-dark)]">
            {error}
          </div>
        )}

        <div className={`flex gap-6 ${sidebarOpen ? "items-start" : ""}`}>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                <section
                  className="grid gap-6"
                  style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(240px, 1fr))` }}
                >
                  {board.columns.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      column={column}
                      cards={filteredCardIds[column.id]?.map((cardId) => board.cards[cardId])}
                      onRename={handleRenameColumn}
                      onAddCard={handleAddCard}
                      onDeleteCard={handleDeleteCard}
                      onDeleteColumn={board.columns.length > 1 ? handleDeleteColumn : undefined}
                      onCardClick={(cardId) => setModalCardId(cardId)}
                    />
                  ))}
                </section>
              </SortableContext>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          <div
            className="w-[340px] shrink-0 rounded-[24px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)] backdrop-blur"
            style={{
              height: "calc(100vh - 200px)",
              position: "sticky",
              top: "24px",
              display: sidebarOpen ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            {denormalizedBoard && (
              <AIChatSidebar
                board={denormalizedBoard}
                boardId={activeBoardId ?? undefined}
                onBoardUpdate={(updated) => setBoard(normalizeBoard(updated))}
              />
            )}
          </div>
        </div>
      </main>

      {/* Card detail modal */}
      {modalCard && (
        <CardDetailModal
          card={modalCard}
          allLabels={allLabels}
          useApi={useApi}
          onSave={async (updates) => {
            await handleCardUpdate(modalCardId!, updates);
          }}
          onDelete={() => {
            const col = board.columns.find((c) => c.cardIds.includes(modalCardId!));
            if (col) handleDeleteCard(col.id, modalCardId!);
            setModalCardId(null);
          }}
          onClose={() => setModalCardId(null)}
          onLabelsChange={(labels) => setAllLabels(labels)}
        />
      )}
    </div>
  );
};

const FullscreenMessage = ({ text }: { text: string }) => (
  <div className="relative overflow-hidden">
    <BgGradients />
    <main className="relative mx-auto flex min-h-screen max-w-[720px] items-center justify-center px-6 py-16 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
      {text}
    </main>
  </div>
);

const BgGradients = () => (
  <>
    <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
    <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />
  </>
);
