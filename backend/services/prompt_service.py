from __future__ import annotations

import re
from pathlib import Path


class PromptService:
    _TEXT_BLOCK_PATTERN = re.compile(r"```text\n(.*?)```", re.DOTALL)
    _PLACEHOLDER_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")

    def __init__(self, prompts_dir: Path | None = None) -> None:
        self.prompts_dir = prompts_dir or Path(__file__).resolve().parents[2] / "prompts"

    def load_prompt(self, prompt_name: str) -> str:
        path = self.prompts_dir / prompt_name
        if not path.exists():
            raise ValueError(f"Prompt file not found: {path}")

        content = path.read_text(encoding="utf-8")
        match = self._TEXT_BLOCK_PATTERN.search(content)
        if not match:
            raise ValueError(f"Prompt file missing fenced text block: {path}")
        return match.group(1).strip()

    def render(self, template: str, variables: dict[str, str]) -> str:
        def replace(match: re.Match[str]) -> str:
            key = match.group(1)
            if key not in variables:
                raise ValueError(f"Missing prompt variable: {key}")
            return variables[key]

        return self._PLACEHOLDER_PATTERN.sub(replace, template)

    def stage_prompts(self, stage: str, variables: dict[str, str]) -> tuple[str, str]:
        system_prompt = self.load_prompt(f"{stage}-system.md")
        user_template = self.load_prompt(f"{stage}-user.md")
        return system_prompt, self.render(user_template, variables)
