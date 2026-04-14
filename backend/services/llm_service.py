from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Optional

from openai import APIStatusError, OpenAI

from config import get_settings

_RETRY_DELAYS = (1, 3, 9)  # seconds between attempts


def _should_retry(exc: Exception) -> bool:
    if isinstance(exc, APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return False


class LLMService:
    def __init__(self, model_name: Optional[str] = None) -> None:
        self.settings = get_settings()
        self._model_name = model_name  # override; None means use settings default

    def stream(self, prompt: str, system_prompt: Optional[str] = None) -> Iterator[str]:
        if not self.settings.base_model_api_key:
            if "JSON" in (system_prompt or "") or "json" in prompt.lower():
                yield (
                    '{"student_name":"Mock Student","current_school":"Mock School","current_grade":"11",'
                    '"intended_interests":["Computer Science","Design"],'
                    '"experiences":[{"category":"activity","title":"Robotics","detail":"Built competition robots"}],'
                    '"achievements":[{"title":"Science Fair","detail":"Presented an AI project"}],'
                    '"school_specific_info":["The program values interdisciplinary learning"],'
                    '"parent_notes":[],"constraints":["Do not exaggerate"],'
                    '"source_summary":"Student has a robotics and AI background."}'
                )
                return
            yield "Mock draft paragraph 1. "
            yield "Mock draft paragraph 2."
            return

        client = OpenAI(api_key=self.settings.base_model_api_key, base_url=self.settings.base_model_base_url)
        model = self._model_name or self.settings.base_model_name
        last_exc: Exception | None = None
        for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
            try:
                stream = client.chat.completions.create(
                    model=model,
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
