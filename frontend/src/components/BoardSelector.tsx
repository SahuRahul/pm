"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardSummary } from "@/lib/kanban";
import { createBoard, deleteBoard, updateBoard } from "@/lib/api";

type Props = {
  boards: BoardSummary[];
  activeBoardId: string;
  onSelect: (boardId: string) => void;
  onBoardsChange: (boards: BoardSummary[]) => void;
};

export const BoardSelector = ({ boards, activeBoardId, onSelect, onBoardsChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!newBoardName.trim()) return;
    try {
      const board = await createBoard(newBoardName.trim());
      const newSummary: BoardSummary = {
        id: board.id,
        name: board.name,
        description: "",
        createdAt: new Date().toISOString(),
        cardCount: 0,
        columnCount: 5,
      };
      const updated = [...boards, newSummary];
      onBoardsChange(updated);
      onSelect(board.id);
      setNewBoardName("");
      setIsCreating(false);
      setIsOpen(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRename = async (boardId: string) => {
    if (!editingName.trim()) return;
    try {
      const updated = await updateBoard(boardId, { name: editingName.trim() });
      onBoardsChange(boards.map((b) => (b.id === boardId ? { ...b, name: updated.name } : b)));
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      const updated = boards.filter((b) => b.id !== boardId);
      onBoardsChange(updated);
      if (activeBoardId === boardId && updated.length > 0) {
        onSelect(updated[0].id);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
        data-testid="board-selector-trigger"
      >
        <span className="max-w-[140px] truncate">{activeBoard?.name ?? "Select Board"}</span>
        <svg className="h-4 w-4 text-[var(--gray-text)]" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[var(--stroke)] bg-white shadow-[0_12px_32px_rgba(3,33,71,0.12)]">
          <div className="border-b border-[var(--stroke)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Your Boards
            </p>
          </div>

          <ul className="max-h-64 overflow-y-auto py-2">
            {boards.map((board) => (
              <li key={board.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface)]">
                {editingId === board.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(board.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded-lg border border-[var(--primary-blue)] px-2 py-1 text-sm text-[var(--navy-dark)] outline-none"
                    />
                    <button onClick={() => handleRename(board.id)} className="text-xs font-semibold text-[var(--primary-blue)]">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-[var(--gray-text)]">✕</button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { onSelect(board.id); setIsOpen(false); }}
                      className="flex flex-1 items-start gap-2 text-left"
                    >
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${board.id === activeBoardId ? "bg-[var(--primary-blue)]" : "bg-[var(--gray-text)]/30"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${board.id === activeBoardId ? "text-[var(--primary-blue)]" : "text-[var(--navy-dark)]"}`}>
                          {board.name}
                        </p>
                        <p className="text-xs text-[var(--gray-text)]">
                          {board.columnCount} columns · {board.cardCount} cards
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setEditingId(board.id); setEditingName(board.name); }}
                        className="rounded p-1 text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                        title="Rename"
                      >
                        ✎
                      </button>
                      {boards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(board.id)}
                          className="rounded p-1 text-[var(--gray-text)] hover:text-red-500"
                          title="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--stroke)] p-3">
            {isCreating ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setIsCreating(false); setNewBoardName(""); }
                  }}
                  placeholder="Board name"
                  className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setNewBoardName(""); setError(null); }}
                    className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full rounded-xl border border-dashed border-[var(--stroke)] py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
                data-testid="new-board-btn"
              >
                + New board
              </button>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-500">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
