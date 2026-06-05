from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ai import call_claude, chat_with_claude
from main import app


def test_call_claude_sends_correct_message_shape():
    mock_text = "The answer is 4"
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=mock_text)]

    with patch("ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "What is 2+2?"}]
        result = call_claude(messages)

        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args
        assert call_kwargs.kwargs["messages"] == messages
        assert "model" in call_kwargs.kwargs
        assert result == mock_text


def test_ai_ping_requires_auth(client):
    resp = client.get("/api/ai/ping")
    assert resp.status_code == 401


def test_ai_ping_returns_response(client):
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="4")]

    with patch("ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        # Log in first
        client.post("/api/auth/login", json={"username": "user", "password": "password"})
        resp = client.get("/api/ai/ping")

    assert resp.status_code == 200
    assert "response" in resp.json()
    assert resp.json()["response"] == "4"

# --- /api/ai/chat tests ---

def _make_mock_response(text: str, tool_input: dict | None = None):
    """Build a mock Anthropic response with optional tool_use block."""
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = text

    if tool_input is None:
        content = [text_block]
    else:
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.name = "update_kanban"
        tool_block.input = tool_input
        content = [text_block, tool_block]

    mock_resp = MagicMock()
    mock_resp.content = content
    return mock_resp


def test_chat_requires_auth(client):
    resp = client.post("/api/ai/chat", json={"messages": [], "board": {}})
    assert resp.status_code == 401


def test_chat_returns_message_no_update(client):
    mock_resp = _make_mock_response("Sure, here is your board!")

    with patch("ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_resp
        mock_get_client.return_value = mock_client

        client.post("/api/auth/login", json={"username": "user", "password": "password"})
        resp = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Show me the board"}], "board": {}},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Sure, here is your board!"
    assert "board" in data
    assert data["board"]["columns"] is not None


def test_chat_applies_kanban_update(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})

    # Get the real board to know column IDs
    board = client.get("/api/board").json()
    first_col_id = board["columns"][0]["id"]

    tool_input = {
        "columns": [
            {
                "id": first_col_id,
                "cards": [{"title": "AI Card", "details": "Created by AI"}],
            }
        ]
    }
    mock_resp = _make_mock_response("I added a card for you.", tool_input)

    with patch("ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_resp
        mock_get_client.return_value = mock_client

        resp = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Add a card"}], "board": board},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "I added a card for you."
    # The first column should now have exactly one card titled "AI Card"
    updated_board = data["board"]
    first_col = next(c for c in updated_board["columns"] if c["id"] == first_col_id)
    card_titles = [updated_board["cards"][cid]["title"] for cid in first_col["cardIds"]]
    assert card_titles == ["AI Card"]


def test_chat_handles_invalid_tool_output_gracefully(client):
    """If the tool block has malformed input, message is returned without a board update."""
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "Here is my reply"

    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = "update_kanban"
    tool_block.input = {"columns": [{"id": "999", "cards": "not-a-list"}]}  # invalid

    mock_resp = MagicMock()
    mock_resp.content = [text_block, tool_block]

    with patch("ai.get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_resp
        mock_get_client.return_value = mock_client

        client.post("/api/auth/login", json={"username": "user", "password": "password"})
        resp = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Hello"}], "board": {}},
        )

    assert resp.status_code == 200
    assert resp.json()["message"] == "Here is my reply"