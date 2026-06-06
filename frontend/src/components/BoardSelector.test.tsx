import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BoardSelector } from "@/components/BoardSelector";
import type { BoardSummary } from "@/lib/kanban";
import * as api from "@/lib/api";

const mockBoards: BoardSummary[] = [
  { id: "1", name: "Sprint Board", description: "", createdAt: "2026-01-01", cardCount: 3, columnCount: 5 },
  { id: "2", name: "Roadmap", description: "Q3 planning", createdAt: "2026-01-02", cardCount: 7, columnCount: 5 },
];

const renderSelector = (activeBoardId = "1") => {
  const onSelect = vi.fn();
  const onBoardsChange = vi.fn();
  const { rerender } = render(
    <BoardSelector
      boards={mockBoards}
      activeBoardId={activeBoardId}
      onSelect={onSelect}
      onBoardsChange={onBoardsChange}
    />
  );
  return { onSelect, onBoardsChange, rerender };
};

describe("BoardSelector", () => {
  it("shows active board name on trigger button", () => {
    renderSelector("1");
    expect(screen.getByTestId("board-selector-trigger")).toHaveTextContent("Sprint Board");
  });

  it("shows other board name when different active", () => {
    renderSelector("2");
    expect(screen.getByTestId("board-selector-trigger")).toHaveTextContent("Roadmap");
  });

  it("opens dropdown on click", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    expect(screen.getByText("Your Boards")).toBeInTheDocument();
    expect(screen.getAllByText(/sprint board|roadmap/i).length).toBeGreaterThan(0);
  });

  it("closes dropdown when clicking outside", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    expect(screen.getByText("Your Boards")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByText("Your Boards")).not.toBeInTheDocument();
  });

  it("calls onSelect when clicking a board", async () => {
    const { onSelect } = renderSelector("1");
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    await userEvent.click(screen.getByText("Roadmap"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows board stats in dropdown", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    const dropdown = screen.getByText("Your Boards").closest("div")!.parentElement!;
    expect(within(dropdown).getByText(/3 cards/i)).toBeInTheDocument();
  });

  it("shows new board button", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    expect(screen.getByTestId("new-board-btn")).toBeInTheDocument();
  });

  it("shows create form when clicking new board", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    await userEvent.click(screen.getByTestId("new-board-btn"));
    expect(screen.getByPlaceholderText("Board name")).toBeInTheDocument();
  });

  it("creates a new board", async () => {
    const newBoard = { id: "3", name: "New Board" };
    vi.spyOn(api, "createBoard").mockResolvedValue(newBoard);
    const { onSelect, onBoardsChange } = renderSelector();

    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    await userEvent.click(screen.getByTestId("new-board-btn"));
    await userEvent.type(screen.getByPlaceholderText("Board name"), "New Board");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(api.createBoard).toHaveBeenCalledWith("New Board");
    expect(onSelect).toHaveBeenCalledWith("3");
    expect(onBoardsChange).toHaveBeenCalled();
  });

  it("cancels new board creation", async () => {
    renderSelector();
    await userEvent.click(screen.getByTestId("board-selector-trigger"));
    await userEvent.click(screen.getByTestId("new-board-btn"));
    expect(screen.getByPlaceholderText("Board name")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByPlaceholderText("Board name")).not.toBeInTheDocument();
    expect(screen.getByTestId("new-board-btn")).toBeInTheDocument();
  });

  it("deletes a board when multiple boards exist", async () => {
    vi.spyOn(api, "deleteBoard").mockResolvedValue(undefined);
    const { onBoardsChange } = renderSelector("1");

    await userEvent.click(screen.getByTestId("board-selector-trigger"));

    // Hover over a board item to reveal delete button
    const boardItem = screen.getByText("Roadmap").closest("li")!;
    await userEvent.hover(boardItem);

    const deleteButtons = within(boardItem).getAllByTitle("Delete");
    await userEvent.click(deleteButtons[0]);

    expect(api.deleteBoard).toHaveBeenCalledWith("2");
    expect(onBoardsChange).toHaveBeenCalled();
  });

  it("shows rename input when clicking rename button", async () => {
    renderSelector("1");
    await userEvent.click(screen.getByTestId("board-selector-trigger"));

    const boardItem = screen.getByText("Roadmap").closest("li")!;
    await userEvent.hover(boardItem);

    const renameBtn = within(boardItem).getByTitle("Rename");
    await userEvent.click(renameBtn);

    expect(within(boardItem).getByRole("textbox")).toHaveValue("Roadmap");
  });

  it("renames a board", async () => {
    vi.spyOn(api, "updateBoard").mockResolvedValue({ id: "2", name: "Updated Name", description: "" });
    const { onBoardsChange } = renderSelector("1");

    await userEvent.click(screen.getByTestId("board-selector-trigger"));

    const boardItem = screen.getByText("Roadmap").closest("li")!;
    await userEvent.hover(boardItem);
    await userEvent.click(within(boardItem).getByTitle("Rename"));

    const input = within(boardItem).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Updated Name");
    await userEvent.click(within(boardItem).getByRole("button", { name: /save/i }));

    expect(api.updateBoard).toHaveBeenCalledWith("2", { name: "Updated Name" });
    expect(onBoardsChange).toHaveBeenCalled();
  });
});
