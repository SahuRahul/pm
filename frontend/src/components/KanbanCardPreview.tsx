import type { Card } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => {
  const priority = card.priority ?? "medium";
  return (
    <article className="rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
      <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
        {card.title}
      </h4>
      {card.details && (
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">{card.details}</p>
      )}
      <div className="mt-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: PRIORITY_COLORS[priority] }}
        >
          {PRIORITY_LABELS[priority]}
        </span>
      </div>
    </article>
  );
};
