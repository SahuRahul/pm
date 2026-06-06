import { moveCard, PRIORITY_COLORS, PRIORITY_LABELS, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", color: "#ecad0a", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", color: "#ecad0a", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("returns unchanged columns when source card not found", () => {
    const result = moveCard(baseColumns, "card-999", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("returns unchanged columns when same card id", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    expect(result).toEqual(baseColumns);
  });
});

describe("priority constants", () => {
  it("has labels for all priorities", () => {
    expect(PRIORITY_LABELS.low).toBe("Low");
    expect(PRIORITY_LABELS.medium).toBe("Medium");
    expect(PRIORITY_LABELS.high).toBe("High");
  });

  it("has colors for all priorities", () => {
    expect(PRIORITY_COLORS.low).toBeDefined();
    expect(PRIORITY_COLORS.medium).toBeDefined();
    expect(PRIORITY_COLORS.high).toBeDefined();
  });
});
