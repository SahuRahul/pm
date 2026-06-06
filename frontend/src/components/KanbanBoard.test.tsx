import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];
const renderBoard = () => render(<KanbanBoard initialBoard={initialData} useApi={false} />);

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    renderBoard();
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows board name in header", () => {
    renderBoard();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Demo Board");
  });

  it("renames a column", async () => {
    renderBoard();
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds a card with default priority badge", async () => {
    renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    // Medium priority badge should appear
    const newCard = within(column).getByText("New card").closest("article")!;
    expect(within(newCard).getByText("Medium")).toBeInTheDocument();
  });

  it("adds a card with high priority", async () => {
    renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));

    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Urgent task");
    const prioritySelect = within(column).getByRole("combobox");
    await userEvent.selectOptions(prioritySelect, "high");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    const newCard = within(column).getByText("Urgent task").closest("article")!;
    expect(within(newCard).getByText("High")).toBeInTheDocument();
  });

  it("removes a card", async () => {
    renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Delete me");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("Delete me")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", { name: /delete delete me/i });
    await userEvent.click(deleteButton);
    expect(within(column).queryByText("Delete me")).not.toBeInTheDocument();
  });

  it("cancels add card form", async () => {
    renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    expect(within(column).getByPlaceholderText(/card title/i)).toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });

  it("shows AI assistant button", () => {
    renderBoard();
    expect(screen.getByRole("button", { name: /ai assistant/i })).toBeInTheDocument();
  });

  it("toggles AI assistant sidebar", async () => {
    renderBoard();
    const aiButton = screen.getByRole("button", { name: /ai assistant/i });
    await userEvent.click(aiButton);
    expect(screen.getByRole("button", { name: /close ai/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /close ai/i }));
    expect(screen.getByRole("button", { name: /ai assistant/i })).toBeInTheDocument();
  });

  it("shows priority badges on initial cards", () => {
    renderBoard();
    // The initialData has cards with priorities
    const priorityBadges = screen.getAllByTestId(/priority-/i);
    expect(priorityBadges.length).toBeGreaterThan(0);
  });

  it("shows column count badges", () => {
    renderBoard();
    const columns = screen.getAllByTestId(/column-/i);
    // Each column header shows "X card(s)" — find the span with class text-gray-text
    columns.forEach((col) => {
      const spans = within(col).getAllByText(/\d+ cards?/i);
      expect(spans.length).toBeGreaterThan(0);
    });
  });
});
