import os

import anthropic

MODEL = "claude-sonnet-4-5"
_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["CLAUDE_API_KEY"])
    return _client


def call_claude(messages: list[dict]) -> str:
    response = get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=messages,
    )
    return response.content[0].text
