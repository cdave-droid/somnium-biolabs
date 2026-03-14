"""Shared Anthropic client with rate limiting and retry logic."""

import asyncio
import os

import anthropic
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_CONCURRENT_CALLS = 8

_client: anthropic.AsyncAnthropic | None = None
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_CALLS)


def get_client() -> anthropic.AsyncAnthropic:
    """Get or create the shared async Anthropic client."""
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY environment variable is required. "
                "Set it with: export ANTHROPIC_API_KEY=sk-..."
            )
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=60),
    retry=retry_if_exception_type(anthropic.RateLimitError),
    stop=stop_after_attempt(5),
)
async def rate_limited_call(
    system: str,
    user_message: str,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 4096,
) -> str:
    """Make a rate-limited API call to Claude with retry on rate limit errors.

    Returns the text content of the response.
    """
    client = get_client()
    async with _semaphore:
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text
