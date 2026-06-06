export type Priority = "low" | "medium" | "high";

export type Label = {
  id: string;
  name: string;
  color: string;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  dueDate: string | null;
  labels: Label[];
};

export type Column = {
  id: string;
  title: string;
  color: string;
  cardIds: string[];
};

export type BoardData = {
  id: string;
  name: string;
  description: string;
  columns: Column[];
  cards: Record<string, Card>;
};

export type BoardSummary = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  cardCount: number;
  columnCount: number;
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "var(--primary-blue)",
  medium: "var(--accent-yellow)",
  high: "#e05252",
};

export const initialData: BoardData = {
  id: "demo",
  name: "Demo Board",
  description: "",
  columns: [
    { id: "col-backlog", title: "Backlog", color: "#ecad0a", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", color: "#ecad0a", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", color: "#ecad0a", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", color: "#ecad0a", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", color: "#ecad0a", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes.", priority: "high", dueDate: null, labels: [] },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags.", priority: "medium", dueDate: null, labels: [] },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch dashboard layout.", priority: "medium", dueDate: null, labels: [] },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels.", priority: "low", dueDate: null, labels: [] },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing.", priority: "medium", dueDate: null, labels: [] },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover and focus.", priority: "high", dueDate: null, labels: [] },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved.", priority: "low", dueDate: null, labels: [] },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes.", priority: "low", dueDate: null, labels: [] },
  },
};

const findColumnId = (columns: Column[], id: string) => {
  if (columns.some((c) => c.id === id)) return id;
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) return columns;

  const activeColumn = columns.find((c) => c.id === activeColumnId);
  const overColumn = columns.find((c) => c.id === overColumnId);
  if (!activeColumn || !overColumn) return columns;

  const isOverColumn = columns.some((c) => c.id === overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter((id) => id !== activeId);
      nextCardIds.push(activeId);
      return columns.map((c) =>
        c.id === activeColumnId ? { ...c, cardIds: nextCardIds } : c
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return columns;

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);
    return columns.map((c) =>
      c.id === activeColumnId ? { ...c, cardIds: nextCardIds } : c
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) return columns;

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((c) => {
    if (c.id === activeColumnId) return { ...c, cardIds: nextActiveCardIds };
    if (c.id === overColumnId) return { ...c, cardIds: nextOverCardIds };
    return c;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};
