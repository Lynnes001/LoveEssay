from __future__ import annotations

from collections.abc import Iterator
from typing import Optional

from openai import OpenAI

from config import get_settings


class FinetuneService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def stream(self, prompt: str, system_prompt: Optional[str] = None) -> Iterator[str]:
        if not self.settings.finetune_api_key:
            yield "Mock styled paragraph."
            return

        client = OpenAI(api_key=self.settings.finetune_api_key, base_url=self.settings.finetune_base_url)
        stream = client.chat.completions.create(
            model=self.settings.finetune_model_name,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
