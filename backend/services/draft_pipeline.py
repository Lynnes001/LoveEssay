from __future__ import annotations

import json
from collections.abc import Iterator

from services.llm_service import LLMService
from services.prompt_service import PromptService


class DraftPipeline:
    """Runs draft stage only. Yields SSE-style chunk events.

    finetune/rewrite is now a separate FinetunePipeline step.
    """

    def __init__(
        self,
        llm_service: LLMService,
        prompt_service: PromptService | None = None,
    ) -> None:
        self.llm_service = llm_service
        self.prompt_service = prompt_service or PromptService()

    def stream(self, session_payload: dict, outline_confirmed: dict) -> Iterator[dict]:
        variables = self._build_draft_variables(session_payload, outline_confirmed)
        draft_system, draft_prompt = self.prompt_service.stage_prompts("draft", variables)

        for chunk in self.llm_service.stream(draft_prompt, system_prompt=draft_system):
            yield {"stage": "draft", "delta": chunk}

    @staticmethod
    def _build_draft_variables(session_payload: dict, outline_confirmed: dict) -> dict[str, str]:
        outline_summary = _format_outline_for_prompt(outline_confirmed)
        grounding_block = _build_grounding_block_from_payload(session_payload)
        return {
            "school_name": session_payload["program"],
            "query_text": session_payload["requirements"],
            "notes": session_payload.get("custom_prompt") or "",
            "grounding_block": grounding_block,
            "profile_json": json.dumps(session_payload.get("profile", {}), ensure_ascii=False),
            "outline_summary": outline_summary,
        }


def _format_outline_for_prompt(outline_data: dict) -> str:
    lines: list[str] = []
    thesis = outline_data.get("thesis", "")
    if thesis:
        lines.append(f"主线：{thesis}")
    intro = outline_data.get("intro", {})
    intro_direction = intro if isinstance(intro, str) else intro.get("direction", "")
    if intro_direction:
        lines.append(f"开头方向：{intro_direction}")
    for section in outline_data.get("sections", []):
        claim = section.get("claim", "")
        refs = ", ".join(section.get("evidence_refs", []))
        lines.append(f"论点 [{section.get('id', '')}]：{claim}（证据：{refs}）")
        if section.get("user_notes"):
            lines.append(f"  用户备注：{section['user_notes']}")
    conclusion = outline_data.get("conclusion", {})
    conclusion_direction = conclusion if isinstance(conclusion, str) else conclusion.get("direction", "")
    if conclusion_direction:
        lines.append(f"结尾方向：{conclusion_direction}")
    controls = outline_data.get("controls", {})
    must_include = controls.get("must_include", [])
    must_avoid = controls.get("must_avoid", [])
    if must_include:
        lines.append(f"必须包含：{', '.join(must_include)}")
    if must_avoid:
        lines.append(f"必须避免：{', '.join(must_avoid)}")
    if controls.get("generation_notes"):
        lines.append(f"生成备注：{controls['generation_notes']}")
    target_lang = controls.get("target_language")
    if target_lang:
        lines.append(f"目标语言：{target_lang}")
    return "\n".join(lines)


def _build_grounding_block_from_payload(session_payload: dict) -> str:
    profile = session_payload.get("profile", {})
    if not profile:
        return "事实白名单：\n- none"
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
    for constraint in profile.get("constraints", []):
        facts.append(f"- constraint: {constraint}")
    facts_block = "\n".join(facts) if facts else "- none"
    return "事实白名单：\n" + facts_block
