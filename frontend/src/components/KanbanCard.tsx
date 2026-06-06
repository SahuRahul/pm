import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onCardClick?: (cardId: string) => void;
};

const formatDate = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;
  return { label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), isPast };
};

export const KanbanCard = ({ card, onDelete, onCardClick }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = card.priority ?? "medium";
  const dateInfo = card.dueDate ? formatDate(card.dueDate) : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150 cursor-pointer",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick?.(card.id)}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">{card.details}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: PRIORITY_COLORS[priority] }}
              data-testid={`priority-${card.id}`}
            >
              {PRIORITY_LABELS[priority]}
            </span>
            {dateInfo && (
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  dateInfo.isPast
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-50 text-[var(--primary-blue)]"
                )}
                data-testid={`due-date-${card.id}`}
              >
                {dateInfo.isPast ? "Overdue " : ""}{dateInfo.label}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="shrink-0 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
          aria-label={`Delete ${card.title}`}
        >
          ✕
        </button>
      </div>
    </article>
  );
};
