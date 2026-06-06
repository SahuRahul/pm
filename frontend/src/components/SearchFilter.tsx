"use client";

import type { Label, Priority } from "@/lib/kanban";

export type FilterState = {
  query: string;
  priority: Priority | "";
  labelId: string;
};

export const emptyFilter: FilterState = { query: "", priority: "", labelId: "" };

type Props = {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  labels: Label[];
  totalCards: number;
  visibleCards: number;
};

export const SearchFilter = ({ filter, onChange, labels, totalCards, visibleCards }: Props) => {
  const isFiltered = filter.query || filter.priority || filter.labelId;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--stroke)] bg-white/80 px-5 py-3 shadow-[var(--shadow)] backdrop-blur">
      {/* Search input */}
      <div className="relative flex-1 min-w-[160px]">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--gray-text)]"
          viewBox="0 0 16 16" fill="none"
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Search cards…"
          className="w-full rounded-xl border border-[var(--stroke)] bg-white py-2 pl-8 pr-3 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          data-testid="search-input"
        />
      </div>

      {/* Priority filter */}
      <select
        value={filter.priority}
        onChange={(e) => onChange({ ...filter, priority: e.target.value as Priority | "" })}
        className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-[var(--navy-dark)] outline-none"
        data-testid="priority-filter"
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Label filter */}
      {labels.length > 0 && (
        <select
          value={filter.labelId}
          onChange={(e) => onChange({ ...filter, labelId: e.target.value })}
          className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-[var(--navy-dark)] outline-none"
          data-testid="label-filter"
        >
          <option value="">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {isFiltered && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter)}
          className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          data-testid="clear-filters"
        >
          Clear
        </button>
      )}

      {/* Result count */}
      <span className="ml-auto text-xs text-[var(--gray-text)]">
        {isFiltered ? `${visibleCards} / ${totalCards} cards` : `${totalCards} cards`}
      </span>
    </div>
  );
};

// Utility: filter cards by current filter state
export function applyFilter(
  cardIds: string[],
  cards: Record<string, { title: string; details: string; priority: string; labels: Array<{ id: string }> }>,
  filter: FilterState
): string[] {
  if (!filter.query && !filter.priority && !filter.labelId) return cardIds;

  return cardIds.filter((id) => {
    const card = cards[id];
    if (!card) return false;

    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!card.title.toLowerCase().includes(q) && !card.details.toLowerCase().includes(q)) {
        return false;
      }
    }

    if (filter.priority && card.priority !== filter.priority) return false;

    if (filter.labelId && !card.labels.some((l) => l.id === filter.labelId)) return false;

    return true;
  });
}
