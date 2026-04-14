# Fact Check User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{outline_summary}}`
- `{{essay_text}}`

```text
请核查下面这篇文书是否严格受限于给定资料和确认的论证框架，输出结构化 JSON 报告。

输出格式（严格 JSON，不含任何解释文字）：
{
  “pass”: true | false,
  “issues”: [
    {
      “type”: “fact_violation | structure_violation | missing_element | soft_risk”,
      “severity”: “high | medium | low”,
      “evidence”: “文书中的原文片段或描述”,
      “suggested_fix”: “修复建议”
    }
  ]
}

判定规则：
1. fact_violation（高优先）：文书中出现的具体事实（经历、奖项、课程、研究、数字、时间线）无法在资料中找到依据。
2. structure_violation（高优先）：文书结构与确认版论证框架偏离——遗漏了论点、新增了核心论点、或改变了主线。
3. missing_element（中优先）：缺少必须包含的内容（目标学校名、至少 3 个具体事实锚点等）。
4. soft_risk（低优先）：家庭背景、成长环境、泛化院校描述等无法明确核实但也非明显捏造的表达。
5. 如果没有任何问题，pass 设为 true，issues 为空数组。
6. 只要有任何 high 或 medium severity 的问题，pass 设为 false。
7. 只有 low severity 的 soft_risk 问题，pass 可以设为 true。

目标学校：{{school_name}}

确认版论证框架：
{{outline_summary}}

{{grounding_block}}

结构化资料：
{{profile_json}}

待检查文书：
{{essay_text}}
```
