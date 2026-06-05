from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ai import call_claude
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
