import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchFilter, applyFilter, emptyFilter, type FilterState } from "./SearchFilter";
import type { Label } from "@/lib/kanban";

const mockLabels: Label[] = [
  { id: "1", name: "Bug", color: "#e05252" },
  { id: "2", name: "Feature", color: "#52b452" },
];

function setup(overrides: Partial<FilterState> = {}, labels = mockLabels) {
  const filter: FilterState = { ...emptyFilter, ...overrides };
  const onChange = vi.fn();
  render(
    <SearchFilter
      filter={filter}
      onChange={onChange}
      labels={labels}
      totalCards={10}
      visibleCards={7}
    />
  );
  return { onChange };
}

describe("SearchFilter", () => {
  it("renders search input, priority and label filters", () => {
    setup();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("priority-filter")).toBeInTheDocument();
    expect(screen.getByTestId("label-filter")).toBeInTheDocument();
  });

  it("calls onChange when search text changes", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ query: "hello" }));
  });

  it("calls onChange when priority changes", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId("priority-filter"), { target: { value: "high" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ priority: "high" }));
  });

  it("calls onChange when label changes", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId("label-filter"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ labelId: "1" }));
  });

  it("shows clear button when filter is active", () => {
    setup({ query: "hello" });
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("hides clear button when filter is empty", () => {
    setup();
    expect(screen.queryByTestId("clear-filters")).not.toBeInTheDocument();
  });

  it("clear button resets filter", () => {
    const { onChange } = setup({ query: "hello" });
    fireEvent.click(screen.getByTestId("clear-filters"));
    expect(onChange).toHaveBeenCalledWith(emptyFilter);
  });

  it("shows total cards count without filter", () => {
    setup();
    expect(screen.getByText("10 cards")).toBeInTheDocument();
  });

  it("shows visible/total count when filtered", () => {
    setup({ query: "hello" });
    expect(screen.getByText("7 / 10 cards")).toBeInTheDocument();
  });

  it("hides label filter when no labels", () => {
    setup({}, []);
    expect(screen.queryByTestId("label-filter")).not.toBeInTheDocument();
  });
});

describe("applyFilter", () => {
  const cards = {
    "card-1": { title: "Fix bug", details: "Critical issue", priority: "high", labels: [{ id: "1" }] },
    "card-2": { title: "Add feature", details: "Nice to have", priority: "low", labels: [] },
    "card-3": { title: "Documentation", details: "Update docs", priority: "medium", labels: [{ id: "2" }] },
  };

  it("returns all ids when filter is empty", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, emptyFilter);
    expect(result).toEqual(["card-1", "card-2", "card-3"]);
  });

  it("filters by query on title", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, query: "bug" });
    expect(result).toEqual(["card-1"]);
  });

  it("filters by query on details", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, query: "docs" });
    expect(result).toEqual(["card-3"]);
  });

  it("filters by priority", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, priority: "low" });
    expect(result).toEqual(["card-2"]);
  });

  it("filters by labelId", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, labelId: "2" });
    expect(result).toEqual(["card-3"]);
  });

  it("combines query + priority filters", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, query: "add", priority: "low" });
    expect(result).toEqual(["card-2"]);
  });

  it("returns empty when no match", () => {
    const result = applyFilter(["card-1", "card-2", "card-3"], cards as never, { ...emptyFilter, query: "zzznomatch" });
    expect(result).toEqual([]);
  });

  it("handles missing card gracefully", () => {
    const result = applyFilter(["card-1", "missing-id"], cards as never, emptyFilter);
    expect(result).toEqual(["card-1", "missing-id"]);
  });
});
