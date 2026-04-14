# Outline Draft User Prompt

Type: `user`

Variables:

- `{{school_name}}`
- `{{requirements}}`
- `{{profile_json}}`

```text
请根据下方学生 profile，为申请 {{school_name}} 的 Personal Statement 起草一份论证蓝图。

申请要求：{{requirements}}

要求：
1. 只输出严格 JSON，不含任何解释或 markdown。
2. 使用中文填写所有文字字段（thesis、claim、direction 等）。
3. sections 数量必须为 2 到 3 个。
4. 每个 section 的 evidence_refs 必须引用 profile 中真实存在的 experiences 或 achievements 的 id（格式：exp_{index} 或 ach_{index}，下标从 1 开始）。
5. must_avoid 中必须包含"编造学校细节"和"空泛拔高"。
6. target_language 留空（null），由用户在确认阶段指定。

输出 JSON 结构如下：
{
  "thesis": "整篇文章的总主线（完整论断，不是标签词）",
  "intro": {
    "direction": "开头段职责和切入方式（描述方向，不是正文）"
  },
  "sections": [
    {
      "id": "s1",
      "claim": "该段要证明的分论点（论点，不是素材标题）",
      "evidence_refs": ["exp_1"],
      "angle": "motivation | growth | academic-fit | personal-quality | future-direction | reflection",
      "user_notes": null
    }
  ],
  "conclusion": {
    "direction": "结尾段职责和回扣方向"
  },
  "controls": {
    "must_include": ["一次体现主动学习的关键经历"],
    "must_avoid": ["编造学校细节", "空泛拔高"],
    "generation_notes": null,
    "target_language": null
  }
}

学生 profile：
{{profile_json}}
```
