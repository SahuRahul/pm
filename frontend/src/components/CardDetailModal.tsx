"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Label, Priority } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/kanban";
import { assignLabel, unassignLabel, createLabel, deleteLabelApi } from "@/lib/api";

type Props = {
  card: Card;
  allLabels: Label[];
  useApi?: boolean;
  onSave: (updates: Partial<Card>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  onLabelsChange?: (labels: Label[]) => void;
};

const PRESET_COLORS = [
  "#209dd7", "#753991", "#ecad0a", "#032147",
  "#e05252", "#52b452", "#f97316", "#6366f1",
];

export const CardDetailModal = ({
  card,
  allLabels,
  useApi = true,
  onSave,
  onDelete,
  onClose,
  onLabelsChange,
}: Props) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [cardLabels, setCardLabels] = useState<Label[]>(card.labels ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);
  const [labelError, setLabelError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const markDirty = () => setIsDirty(true);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        details,
        priority,
        dueDate: dueDate || null,
      });
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLabel = async (label: Label) => {
    const isAssigned = cardLabels.some((l) => l.id === label.id);
    let nextLabels: Label[];
    if (isAssigned) {
      nextLabels = cardLabels.filter((l) => l.id !== label.id);
      if (useApi) await unassignLabel(card.id.replace(/^card-/, ""), label.id);
    } else {
      nextLabels = [...cardLabels, label];
      if (useApi) await assignLabel(card.id.replace(/^card-/, ""), label.id);
    }
    setCardLabels(nextLabels);
    onSave({ labels: nextLabels });
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    setLabelError(null);
    try {
      let newLabel: Label;
      if (useApi) {
        const { createLabel: apiCreateLabel } = await import("@/lib/api");
        newLabel = await apiCreateLabel(newLabelName.trim(), newLabelColor);
      } else {
        newLabel = { id: String(Date.now()), name: newLabelName.trim(), color: newLabelColor };
      }
      onLabelsChange?.([...allLabels, newLabel]);
      // Auto-assign to current card
      const nextLabels = [...cardLabels, newLabel];
      setCardLabels(nextLabels);
      if (useApi) await assignLabel(card.id.replace(/^card-/, ""), newLabel.id);
      onSave({ labels: nextLabels });
      setNewLabelName("");
      setNewLabelColor(PRESET_COLORS[0]);
    } catch (err) {
      setLabelError((err as Error).message);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (useApi) await deleteLabelApi(labelId);
    const updatedAll = allLabels.filter((l) => l.id !== labelId);
    onLabelsChange?.(updatedAll);
    const updatedCard = cardLabels.filter((l) => l.id !== labelId);
    setCardLabels(updatedCard);
    onSave({ labels: updatedCard });
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
    >
      <div className="w-full max-w-lg rounded-[32px] border border-[var(--stroke)] bg-white shadow-[0_24px_64px_rgba(3,33,71,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Card Details
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] mb-2">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              placeholder="Card title"
              data-testid="modal-title-input"
            />
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] mb-2">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => { setDetails(e.target.value); markDirty(); }}
              rows={4}
              className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              placeholder="Add details, notes, acceptance criteria…"
              data-testid="modal-details-input"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => { setPriority(e.target.value as Priority); markDirty(); }}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--navy-dark)] outline-none"
                data-testid="modal-priority-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none"
                data-testid="modal-due-date-input"
              />
            </div>
          </div>

          {/* Priority badge preview */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: PRIORITY_COLORS[priority] }}
            >
              {PRIORITY_LABELS[priority]}
            </span>
            {dueDate && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[var(--primary-blue)]">
                Due {new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Labels
              </label>
              <button
                type="button"
                onClick={() => setShowLabelPicker((v) => !v)}
                className="text-xs font-semibold text-[var(--primary-blue)] hover:underline"
              >
                {showLabelPicker ? "Done" : "+ Manage"}
              </button>
            </div>

            {/* Assigned labels */}
            <div className="flex flex-wrap gap-2 min-h-[24px]" data-testid="card-labels">
              {cardLabels.length === 0 && !showLabelPicker && (
                <p className="text-xs text-[var(--gray-text)]">No labels</p>
              )}
              {cardLabels.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: l.color }}
                >
                  {l.name}
                </span>
              ))}
            </div>

            {/* Label picker */}
            {showLabelPicker && (
              <div className="mt-3 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                  Available labels
                </p>
                <div className="space-y-1">
                  {allLabels.map((label) => {
                    const assigned = cardLabels.some((l) => l.id === label.id);
                    return (
                      <div key={label.id} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleLabel(label)}
                          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white transition"
                        >
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className={`text-sm font-medium ${assigned ? "text-[var(--navy-dark)]" : "text-[var(--gray-text)]"}`}>
                            {label.name}
                          </span>
                          {assigned && (
                            <span className="ml-auto text-[var(--primary-blue)]">✓</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLabel(label.id)}
                          className="p-1 text-xs text-[var(--gray-text)] hover:text-red-500"
                          title="Delete label"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Create new label */}
                <div className="border-t border-[var(--stroke)] pt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] mb-2">
                    Create new label
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateLabel(); }}
                      placeholder="Label name"
                      className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--primary-blue)]"
                      data-testid="new-label-name-input"
                    />
                    <button
                      type="button"
                      onClick={handleCreateLabel}
                      className="rounded-lg bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white"
                      data-testid="create-label-btn"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewLabelColor(c)}
                        className={`h-5 w-5 rounded-full transition ${newLabelColor === c ? "ring-2 ring-offset-1 ring-[var(--navy-dark)]" : ""}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                  {labelError && <p className="mt-1 text-xs text-red-500">{labelError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--stroke)] px-6 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-500 transition hover:border-red-200 hover:bg-red-50"
            data-testid="modal-delete-btn"
          >
            Delete card
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || !title.trim()}
              className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
              data-testid="modal-save-btn"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
