from __future__ import annotations

import json
from collections.abc import Iterator

from services.llm_service import LLMService
from services.prompt_service import PromptService


class OutlinePipeline:
    """Runs extraction + outline_draft stages, yields SSE-style chunk events.

    The caller is responsible for persisting the outline_candidate once streaming
    completes. The final outline data dict is available via `outline_data` after
    the iterator is exhausted without raising.
    """

    def __init__(self, llm_service: LLMService, prompt_service: PromptService | None = None) -> None:
        self.llm_service = llm_service
        self.prompt_service = prompt_service or PromptService()
        self.outline_data: dict | None = None
        self.profile_data: dict | None = None

    def stream(self, session_payload: dict) -> Iterator[dict]:
        # --- stage 1: extraction ---
        extraction_variables = self._build_extraction_variables(session_payload)
        extraction_system, extraction_prompt = self.prompt_service.stage_prompts("extraction", extraction_variables)

        extraction_parts: list[str] = []
        for chunk in self.llm_service.stream(extraction_prompt, system_prompt=extraction_system):
            extraction_parts.append(chunk)
            yield {"stage": "extraction", "delta": chunk}

        extraction_text = "".join(extraction_parts).strip()
        extraction_text = _strip_fences(extraction_text)
        try:
            profile = json.loads(extraction_text)
            self.profile_data = profile
        except json.JSONDecodeError as exc:
            preview = extraction_text[:200]
            raise ValueError(f"Extraction stage returned invalid JSON. Preview: {preview!r}") from exc

        # --- stage 2: outline_draft ---
        outline_variables = self._build_outline_variables(session_payload, extraction_text)
        outline_system, outline_prompt = self.prompt_service.stage_prompts("outline_draft", outline_variables)

        outline_parts: list[str] = []
        for chunk in self.llm_service.stream(outline_prompt, system_prompt=outline_system):
            outline_parts.append(chunk)
            yield {"stage": "outline_draft", "delta": chunk}

        outline_text = "".join(outline_parts).strip()
        outline_text = _strip_fences(outline_text)
        try:
            self.outline_data = json.loads(outline_text)
        except json.JSONDecodeError as exc:
            preview = outline_text[:200]
            raise ValueError(f"Outline draft stage returned invalid JSON. Preview: {preview!r}") from exc

    @staticmethod
    def _build_extraction_variables(session_payload: dict) -> dict[str, str]:
        notes = session_payload.get("custom_prompt") or ""
        chunk_parts = [
            f"Student background:\n{session_payload['student_background']}",
            f"Requirements:\n{session_payload['requirements']}",
        ]
        if notes:
            chunk_parts.append(f"Additional notes:\n{notes}")
        return {
            "school_name": session_payload["program"],
            "chunk_section_type": "student_background",
            "chunk_content": "\n\n".join(chunk_parts),
        }

    @staticmethod
    def _build_outline_variables(session_payload: dict, profile_json: str) -> dict[str, str]:
        return {
            "school_name": session_payload["program"],
            "requirements": session_payload["requirements"],
            "profile_json": profile_json,
        }


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        return "\n".join(line for line in lines if not line.strip().startswith("```")).strip()
    return text
