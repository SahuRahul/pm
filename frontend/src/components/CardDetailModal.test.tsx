import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CardDetailModal } from "./CardDetailModal";
import type { Card, Label } from "@/lib/kanban";

const mockCard: Card = {
  id: "card-1",
  title: "Test card",
  details: "Some details",
  priority: "medium",
  dueDate: null,
  labels: [],
};

const mockLabels: Label[] = [
  { id: "1", name: "Bug", color: "#e05252" },
  { id: "2", name: "Feature", color: "#52b452" },
];

function setup(overrides: Partial<Parameters<typeof CardDetailModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn();
  const onClose = vi.fn();
  const onLabelsChange = vi.fn();

  render(
    <CardDetailModal
      card={mockCard}
      allLabels={mockLabels}
      useApi={false}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
      onLabelsChange={onLabelsChange}
      {...overrides}
    />
  );

  return { onSave, onDelete, onClose, onLabelsChange };
}

describe("CardDetailModal", () => {
  it("renders card title and details", () => {
    setup();
    expect(screen.getByTestId("modal-title-input")).toHaveValue("Test card");
    expect(screen.getByTestId("modal-details-input")).toHaveValue("Some details");
  });

  it("renders the correct priority", () => {
    setup();
    expect(screen.getByTestId("modal-priority-select")).toHaveValue("medium");
  });

  it("save button is disabled when not dirty", () => {
    setup();
    expect(screen.getByTestId("modal-save-btn")).toBeDisabled();
  });

  it("save button enables after title change", () => {
    setup();
    const titleInput = screen.getByTestId("modal-title-input");
    fireEvent.change(titleInput, { target: { value: "Updated title" } });
    expect(screen.getByTestId("modal-save-btn")).not.toBeDisabled();
  });

  it("save button disabled if title is cleared", () => {
    setup();
    const titleInput = screen.getByTestId("modal-title-input");
    fireEvent.change(titleInput, { target: { value: "" } });
    expect(screen.getByTestId("modal-save-btn")).toBeDisabled();
  });

  it("calls onSave with updated values", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByTestId("modal-title-input"), { target: { value: "New title" } });
    fireEvent.click(screen.getByTestId("modal-save-btn"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New title" })
    ));
  });

  it("calls onDelete when delete button clicked", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByTestId("modal-delete-btn"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("calls onClose when cancel clicked", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows label picker on manage click", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Manage" }));
    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });

  it("toggles label assignment without API", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Manage" }));
    // Click 'Bug' label to assign
    fireEvent.click(screen.getByRole("button", { name: /Bug/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ labels: expect.arrayContaining([expect.objectContaining({ name: "Bug" })]) })
      )
    );
  });

  it("shows new label input in picker", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Manage" }));
    expect(screen.getByTestId("new-label-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("create-label-btn")).toBeInTheDocument();
  });

  it("creates a new label without API", async () => {
    const { onLabelsChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Manage" }));
    fireEvent.change(screen.getByTestId("new-label-name-input"), { target: { value: "Urgent" } });
    fireEvent.click(screen.getByTestId("create-label-btn"));
    await waitFor(() =>
      expect(onLabelsChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: "Urgent" })])
      )
    );
  });

  it("renders due date badge when dueDate is set", () => {
    setup({ card: { ...mockCard, dueDate: "2099-12-31" } });
    expect(screen.getByText(/Dec 31/)).toBeInTheDocument();
  });

  it("renders card with pre-assigned labels", () => {
    const cardWithLabel: Card = { ...mockCard, labels: [mockLabels[0]] };
    setup({ card: cardWithLabel });
    const labelContainer = screen.getByTestId("card-labels");
    expect(labelContainer).toHaveTextContent("Bug");
  });
});
