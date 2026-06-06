import { useState, type FormEvent } from "react";
import type { Priority } from "@/lib/kanban";

const initialFormState = { title: "", details: "", priority: "medium" as Priority, dueDate: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string, priority: Priority, dueDate: string | null) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onAdd(form.title.trim(), form.details.trim(), form.priority, form.dueDate || null);
    setForm(initialFormState);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          + Add a card
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Card title"
          className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          required
          autoFocus
        />
        <textarea
          value={form.details}
          onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
          placeholder="Details (optional)"
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <div className="flex gap-2">
          <select
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}
            className="flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-[var(--navy-dark)] outline-none"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            className="flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Add card
          </button>
          <button
            type="button"
            onClick={() => { setIsOpen(false); setForm(initialFormState); }}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
