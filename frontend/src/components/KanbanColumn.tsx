import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column, Priority } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: (Card | undefined)[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string, priority: Priority, dueDate: string | null) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onCardClick?: (cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onCardClick,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const validCards = cards.filter((c): c is Card => c !== undefined);

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div
              className="h-2 w-10 rounded-full shrink-0"
              style={{ backgroundColor: column.color || "var(--accent-yellow)" }}
            />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {validCards.length} card{validCards.length !== 1 ? "s" : ""}
            </span>
          </div>
          <input
            value={column.title}
            onChange={(e) => onRename(column.id, e.target.value)}
            className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
            aria-label="Column title"
          />
        </div>
        {onDeleteColumn && (
          <button
            type="button"
            onClick={() => onDeleteColumn(column.id)}
            className="shrink-0 mt-1 rounded-full border border-transparent p-1 text-xs text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-red-500"
            aria-label={`Delete ${column.title} column`}
            title="Delete column"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {validCards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onCardClick={onCardClick}
            />
          ))}
        </SortableContext>
        {validCards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>

      <NewCardForm
        onAdd={(title, details, priority, dueDate) =>
          onAddCard(column.id, title, details, priority, dueDate)
        }
      />
    </section>
  );
};
