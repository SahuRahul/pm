import os

import anthropic
from pydantic import BaseModel

MODEL = "claude-sonnet-4-6"
_client: anthropic.Anthropic | None = None


# --- Pydantic models ---

class CardData(BaseModel):
    id: str | None = None  # None = new card
    title: str
    details: str = ""


class ColumnUpdate(BaseModel):
    id: str  # existing column ID
    cards: list[CardData]


class KanbanUpdate(BaseModel):
    columns: list[ColumnUpdate]


class AIResponse(BaseModel):
    message: str
    kanban_update: KanbanUpdate | None = None


# --- Tool definition for structured board updates ---

_KANBAN_TOOL: dict = {
    "name": "update_kanban",
    "description": (
        "Update the Kanban board. Call this whenever the user asks to create, edit, "
        "move, or delete cards. Supply only the columns that need to change; "
        "each supplied column's cards list fully replaces that column's current cards."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Existing column ID"},
                        "cards": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string", "description": "Existing card ID (omit for new cards)"},
                                    "title": {"type": "string"},
                                    "details": {"type": "string"},
                                },
                                "required": ["title"],
                            },
                        },
                    },
                    "required": ["id", "cards"],
                },
            }
        },
        "required": ["columns"],
    },
}

_SYSTEM = (
    "You are an AI assistant embedded in a Kanban project management app. "
    "You can view and modify the user's Kanban board. "
    "When the user asks you to change the board (add, edit, move, or delete cards), "
    "call the update_kanban tool with the affected columns. "
    "Always include a friendly natural-language reply in addition to any tool call."
)


# --- Client ---

def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["CLAUDE_API_KEY"])
    return _client


# --- API helpers ---

def call_claude(messages: list[dict]) -> str:
    """Simple single-call helper (used by /api/ai/ping)."""
    response = get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=messages,
    )
    return response.content[0].text


def chat_with_claude(messages: list[dict], board: dict) -> AIResponse:
    """
    Chat with Claude, passing the current board state in the system prompt.
    Returns a structured AIResponse (message + optional kanban_update).
    """
    system = f"{_SYSTEM}\n\nCurrent board (JSON):\n{board}"

    response = get_client().messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        tools=[_KANBAN_TOOL],
        messages=messages,
    )

    message_text = ""
    kanban_update: KanbanUpdate | None = None

    for block in response.content:
        if block.type == "text":
            message_text += block.text
        elif block.type == "tool_use" and block.name == "update_kanban":
            try:
                cols = [
                    ColumnUpdate(
                        id=col["id"],
                        cards=[CardData(**c) for c in col["cards"]],
                    )
                    for col in block.input.get("columns", [])
                ]
                kanban_update = KanbanUpdate(columns=cols)
            except Exception:
                pass  # invalid structured output — ignore update, keep message

    return AIResponse(message=message_text.strip(), kanban_update=kanban_update)
