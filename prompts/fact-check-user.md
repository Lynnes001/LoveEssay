# Fact Check User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{essay_text}}`

```text
请核查下面这篇英文文书是否严格受限于给定资料，并把问题区分为“硬问题”和“软问题”。
输出 JSON：
{
  "hard_unsupported_claims": string[],
  "soft_risk_claims": string[],
  "missing_required_elements": string[],
  "notes": string[]
}

判定标准：
1. hard_unsupported_claims：必须是具体且可核验的事实性错误，例如新增经历、新增奖项、新增课程、新增研究、新增实习、新增领导职务、新增时间线事实。
2. soft_risk_claims：记录较软的风险表述，包括未经资料支持的家庭背景、成长环境、家庭价值观推断，以及泛化的院校优势、气质、跨学科氛围、资源丰富等描述。此类问题不要升级为硬问题，除非它已经构成明确且关键的具体事实。
3. missing_required_elements：缺少 primary interest、secondary interest、目标学校名等硬性要素；如果文章没有清楚写出至少 3 个来自资料的具体事实，也放在这里。
4. 如果文书只是使用了克制、抽象、非具体事实型的 why school 表达，不要判为 hard_unsupported_claims。
5. 如果文章提到了具体活动、奖项、课程、研究、实习、领导职务、数字成绩、个人经历，请逐项核对是否能在资料里找到依据。
6. 如果文章提到了家庭故事、家庭经济条件、父母职业、成长环境、家庭教育方式，但资料里没有明确写出，请记入 soft_risk_claims，而不是 hard_unsupported_claims。
7. 如果文章只是泛泛而谈、几乎看不出资料中的真实经历，也要明确指出缺失了哪些应当落地的事实锚点。
8. 返回 JSON 即可，不要附加解释文字。

目标学校：{{school_name}}
{{grounding_block}}

结构化资料：
{{profile_json}}

待检查文书：
{{essay_text}}
```
