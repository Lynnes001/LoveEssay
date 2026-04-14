from __future__ import annotations

import json
from collections.abc import Iterator

from services.llm_service import LLMService
from services.prompt_service import PromptService


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        return "\n".join(line for line in lines if not line.strip().startswith("```")).strip()
    return text


class FactCheckPipeline:
    """Runs fact_check stage: streams the check, parses the JSON report.

    After the iterator is exhausted without raising, `report` contains the parsed dict.
    """

    def __init__(self, llm_service: LLMService, prompt_service: PromptService | None = None) -> None:
        self.llm_service = llm_service
        self.prompt_service = prompt_service or PromptService()
        self.report: dict | None = None

    def stream(self, essay_text: str, session_payload: dict, outline_data: dict) -> Iterator[dict]:
        from services.draft_pipeline import _format_outline_for_prompt, _build_grounding_block_from_payload

        variables = {
            "school_name": session_payload.get("program", ""),
            "grounding_block": _build_grounding_block_from_payload(session_payload),
            "profile_json": json.dumps(session_payload.get("profile", {}), ensure_ascii=False),
            "outline_summary": _format_outline_for_prompt(outline_data),
            "essay_text": essay_text,
        }
        system_prompt, user_prompt = self.prompt_service.stage_prompts("fact_check", variables)

        parts: list[str] = []
        for chunk in self.llm_service.stream(user_prompt, system_prompt=system_prompt):
            parts.append(chunk)
            yield {"stage": "fact_check", "delta": chunk}

        raw = _strip_fences("".join(parts).strip())
        try:
            self.report = json.loads(raw)
        except json.JSONDecodeError as exc:
            preview = raw[:200]
            raise ValueError(f"Fact check stage returned invalid JSON. Preview: {preview!r}") from exc


class RepairPipeline:
    """Runs repair stage: streams the repaired essay text."""

    def __init__(self, llm_service: LLMService, prompt_service: PromptService | None = None) -> None:
        self.llm_service = llm_service
        self.prompt_service = prompt_service or PromptService()

    def stream(self, essay_text: str, issues: list, session_payload: dict, outline_data: dict) -> Iterator[dict]:
        from services.draft_pipeline import _format_outline_for_prompt, _build_grounding_block_from_payload

        variables = {
            "school_name": session_payload.get("program", ""),
            "outline_summary": _format_outline_for_prompt(outline_data),
            "issues_json": json.dumps(issues, ensure_ascii=False, indent=2),
            "grounding_block": _build_grounding_block_from_payload(session_payload),
            "profile_json": json.dumps(session_payload.get("profile", {}), ensure_ascii=False),
            "essay_text": essay_text,
        }
        system_prompt, user_prompt = self.prompt_service.stage_prompts("repair", variables)

        for chunk in self.llm_service.stream(user_prompt, system_prompt=system_prompt):
            yield {"stage": "repair", "delta": chunk}
