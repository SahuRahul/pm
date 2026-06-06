import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanCard } from "@/components/KanbanCard";
import type { Card } from "@/lib/kanban";

// KanbanCard uses useSortable which needs DnD context — mock it
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: "card-1",
  title: "Test Card",
  details: "Some details",
  priority: "medium",
  dueDate: null,
  ...overrides,
});

describe("KanbanCard", () => {
  it("renders title and details", () => {
    render(<KanbanCard card={makeCard()} onDelete={vi.fn()} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Some details")).toBeInTheDocument();
  });

  it("shows medium priority badge by default", () => {
    render(<KanbanCard card={makeCard()} onDelete={vi.fn()} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows high priority badge", () => {
    render(<KanbanCard card={makeCard({ priority: "high" })} onDelete={vi.fn()} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows low priority badge", () => {
    render(<KanbanCard card={makeCard({ priority: "low" })} onDelete={vi.fn()} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("shows due date when set", () => {
    render(<KanbanCard card={makeCard({ dueDate: "2030-12-31" })} onDelete={vi.fn()} />);
    expect(screen.getByTestId("due-date-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("due-date-card-1")).toHaveTextContent("Dec 31");
  });

  it("does not show due date when null", () => {
    render(<KanbanCard card={makeCard({ dueDate: null })} onDelete={vi.fn()} />);
    expect(screen.queryByTestId("due-date-card-1")).not.toBeInTheDocument();
  });

  it("calls onDelete when remove button clicked", async () => {
    const onDelete = vi.fn();
    render(<KanbanCard card={makeCard()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /delete test card/i }));
    expect(onDelete).toHaveBeenCalledWith("card-1");
  });

  it("has testid attribute", () => {
    render(<KanbanCard card={makeCard()} onDelete={vi.fn()} />);
    expect(screen.getByTestId("card-card-1")).toBeInTheDocument();
  });
});
