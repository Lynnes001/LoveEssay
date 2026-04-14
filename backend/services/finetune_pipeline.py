from __future__ import annotations

import json
from collections.abc import Iterator

from services.draft_pipeline import _build_grounding_block_from_payload, _format_outline_for_prompt
from services.finetune_service import FinetuneService
from services.prompt_service import PromptService


class FinetunePipeline:
    """Runs the finetune/rewrite stage using the customised model.

    Accepts the draft text produced by DraftPipeline and yields SSE-style
    chunk events with stage="finetuned".
    """

    def __init__(
        self,
        finetune_service: FinetuneService,
        prompt_service: PromptService | None = None,
    ) -> None:
        self.finetune_service = finetune_service
        self.prompt_service = prompt_service or PromptService()

    def stream(self, draft_text: str, session_payload: dict, outline_data: dict) -> Iterator[dict]:
        variables = self._build_variables(draft_text, session_payload, outline_data)
        # Prompt template key stays "rewrite" (existing prompt files)
        system_prompt, user_prompt = self.prompt_service.stage_prompts("rewrite", variables)

        for chunk in self.finetune_service.stream(user_prompt, system_prompt=system_prompt):
            yield {"stage": "finetuned", "delta": chunk}

    @staticmethod
    def _build_variables(draft_text: str, session_payload: dict, outline_data: dict) -> dict[str, str]:
        return {
            "school_name": session_payload.get("program", ""),
            "query_text": session_payload.get("requirements", ""),
            "notes": session_payload.get("custom_prompt") or "",
            "grounding_block": _build_grounding_block_from_payload(session_payload),
            "profile_json": json.dumps(session_payload.get("profile", {}), ensure_ascii=False),
            "outline_summary": _format_outline_for_prompt(outline_data),
            "draft_text": draft_text,
        }
