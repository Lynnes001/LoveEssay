# Repair User Prompt

Type: `user`

Variables:

- `{{school_name}}`
- `{{outline_summary}}`
- `{{issues_json}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{essay_text}}`

```text
请根据下面的问题报告，修复这篇文书。

修复原则：
1. 只修复 issues 列表中列出的具体问题，不要重构论证框架。
2. fact_violation 和 structure_violation 类问题必须修复：删除或替换无依据的事实，不能保留。
3. missing_element 问题必须补齐。
4. soft_risk 问题尽量弱化；如果改动会严重影响流畅度，可以保留克制表达。
5. 不得引入资料之外的新事实。
6. 只输出修复后的正文，不要解释。

目标学校：{{school_name}}

确认版论证框架（严禁重构）：
{{outline_summary}}

问题报告：
{{issues_json}}

{{grounding_block}}

结构化资料：
{{profile_json}}

待修复文书：
{{essay_text}}
```

