from __future__ import annotations

import json

from services.pipeline import GenerationPipeline


class FakeStreamingProvider:
    def __init__(self, chunks_per_call):
        self.chunks_per_call = chunks_per_call
        self.calls = []

    def stream(self, prompt: str, system_prompt=None):
        self.calls.append({"prompt": prompt, "system_prompt": system_prompt})
        yield from self.chunks_per_call[len(self.calls) - 1]


def test_pipeline_streams_llm_then_finetune_output():
    extraction_json = json.dumps(
        {
            "student_name": "Alice",
            "current_school": "No. 2 High School",
            "current_grade": "11",
            "intended_interests": ["Computer Science", "Design"],
            "experiences": [{"category": "activity", "title": "Robotics", "detail": "Built robots"}],
            "achievements": [{"title": "Math Award", "detail": "Won city prize"}],
            "school_specific_info": ["CMU values interdisciplinary learning"],
            "parent_notes": [],
            "constraints": ["Do not exaggerate"],
            "source_summary": "Student has robotics and math background.",
        },
        ensure_ascii=False,
    )
    llm = FakeStreamingProvider([[extraction_json], ["draft-a", "draft-b"]])
    finetune = FakeStreamingProvider([["rewrite-a"]])
    pipeline = GenerationPipeline(llm_service=llm, finetune_service=finetune)

    events = list(
        pipeline.stream(
            {
                "student_background": "AI research, robotics internship",
                "program": "CMU MSCV",
                "requirements": "800 words, mention initiative",
                "custom_prompt": "Keep the tone warm.",
            }
        )
    )

    assert [event["stage"] for event in events] == [
        "extraction",
        "draft",
        "draft",
        "rewrite",
    ]
    assert "".join(event["delta"] for event in events if event["stage"] == "draft") == "draft-adraft-b"
    assert llm.calls[0]["system_prompt"] is not None
    assert "严格 JSON" in llm.calls[0]["system_prompt"]
    assert "目标学校：CMU MSCV" in llm.calls[0]["prompt"]
    assert "AI research, robotics internship" in llm.calls[0]["prompt"]
    assert llm.calls[1]["system_prompt"] is not None
    assert "personal statement" in llm.calls[1]["system_prompt"]
    assert "白名单" in llm.calls[1]["prompt"]
    assert "CMU MSCV" in llm.calls[1]["prompt"]
    assert extraction_json in llm.calls[1]["prompt"]
    assert finetune.calls[0]["system_prompt"] is not None
    assert "rewriting assistant" in finetune.calls[0]["system_prompt"]
    assert "英文初稿：" in finetune.calls[0]["prompt"]
    assert "draft-adraft-b" in finetune.calls[0]["prompt"]


def test_pipeline_raises_on_invalid_extraction_json():
    llm = FakeStreamingProvider([["not-json"]])
    finetune = FakeStreamingProvider([["unused"]])
    pipeline = GenerationPipeline(llm_service=llm, finetune_service=finetune)

    try:
        list(
            pipeline.stream(
                {
                    "student_background": "AI research, robotics internship",
                    "program": "CMU MSCV",
                    "requirements": "800 words, mention initiative",
                }
            )
        )
    except ValueError as exc:
        assert "Extraction stage returned invalid JSON" in str(exc)
    else:
        raise AssertionError("Expected pipeline to raise ValueError for invalid extraction JSON")
