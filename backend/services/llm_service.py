from __future__ import annotations

from collections.abc import Iterator
from typing import Optional

from openai import OpenAI

from config import get_settings


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()

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
        stream = client.chat.completions.create(
            model=self.settings.base_model_name,
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
