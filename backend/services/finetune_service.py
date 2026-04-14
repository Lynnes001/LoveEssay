from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Optional

from openai import APIStatusError, OpenAI

from config import get_settings

_RETRY_DELAYS = (1, 3, 9)


def _should_retry(exc: Exception) -> bool:
    if isinstance(exc, APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return False


class FinetuneService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def stream(self, prompt: str, system_prompt: Optional[str] = None) -> Iterator[str]:
        if not self.settings.finetune_api_key:
            yield "Mock styled paragraph."
            return

        client = OpenAI(api_key=self.settings.finetune_api_key, base_url=self.settings.finetune_base_url)
        last_exc: Exception | None = None
        for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
            try:
                stream = client.chat.completions.create(
                    model=self.settings.finetune_model_name,
                    stream=True,
                    messages=[
                        {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                        {"role": "user", "content": prompt},
                    ],
                    extra_body={"enable_thinking": False},
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        yield delta
                return
            except Exception as exc:
                last_exc = exc
                if not _should_retry(exc) or delay is None:
                    raise
                time.sleep(delay)
        raise last_exc  # type: ignore[misc]
