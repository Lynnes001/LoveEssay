from __future__ import annotations

import json
from collections.abc import Iterator

from services.finetune_service import FinetuneService
from services.llm_service import LLMService
from services.prompt_service import PromptService


class GenerationPipeline:
    def __init__(
        self,
        llm_service: LLMService,
        finetune_service: FinetuneService,
        prompt_service: PromptService | None = None,
    ) -> None:
        self.llm_service = llm_service
        self.finetune_service = finetune_service
        self.prompt_service = prompt_service or PromptService()

    def stream(self, session_payload: dict) -> Iterator[dict]:
        extraction_variables = self._build_extraction_variables(session_payload)
        extraction_system, extraction_prompt = self.prompt_service.stage_prompts("extraction", extraction_variables)

        extraction_parts: list[str] = []
        for chunk in self.llm_service.stream(extraction_prompt, system_prompt=extraction_system):
            extraction_parts.append(chunk)
            yield {"stage": "extraction", "delta": chunk}

        extraction_text = "".join(extraction_parts).strip()
        try:
            profile = json.loads(extraction_text)
        except json.JSONDecodeError as exc:
            raise ValueError("Extraction stage returned invalid JSON") from exc

        common_variables = self._build_common_variables(session_payload, profile, extraction_text)
        draft_system, draft_prompt = self.prompt_service.stage_prompts("draft", common_variables)

        draft_parts: list[str] = []
        for chunk in self.llm_service.stream(draft_prompt, system_prompt=draft_system):
            draft_parts.append(chunk)
            yield {"stage": "draft", "delta": chunk}

        rewrite_variables = dict(common_variables, draft_text="".join(draft_parts))
        rewrite_system, rewrite_prompt = self.prompt_service.stage_prompts("rewrite", rewrite_variables)
        for chunk in self.finetune_service.stream(rewrite_prompt, system_prompt=rewrite_system):
            yield {"stage": "rewrite", "delta": chunk}

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

    def _build_common_variables(self, session_payload: dict, profile: dict, extraction_text: str) -> dict[str, str]:
        return {
            "school_name": session_payload["program"],
            "query_text": session_payload["requirements"],
            "notes": session_payload.get("custom_prompt") or "",
            "grounding_block": self._build_grounding_block(profile),
            "profile_json": extraction_text,
        }

    @staticmethod
    def _build_grounding_block(profile: dict) -> str:
        facts: list[str] = []
        for key in ("student_name", "current_school", "current_grade", "source_summary"):
            value = profile.get(key)
            if value:
                facts.append(f"- {key}: {value}")

        for interest in profile.get("intended_interests", []):
            facts.append(f"- intended_interest: {interest}")
        for experience in profile.get("experiences", []):
            facts.append(
                "- experience: "
                f"{experience.get('category', '')} | {experience.get('title', '')} | {experience.get('detail', '')}"
            )
        for achievement in profile.get("achievements", []):
            facts.append(f"- achievement: {achievement.get('title', '')} | {achievement.get('detail', '')}")
        for info in profile.get("school_specific_info", []):
            facts.append(f"- school_specific_info: {info}")
        for note in profile.get("parent_notes", []):
            facts.append(f"- parent_note: {note}")
        for constraint in profile.get("constraints", []):
            facts.append(f"- constraint: {constraint}")

        facts_block = "\n".join(facts) if facts else "- none"
        return "事实白名单：\n" + facts_block
