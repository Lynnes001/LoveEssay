# Draft User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{query_text}}`
- `{{notes}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{outline_summary}}`

```text
请根据下方已确认的论证框架和学生资料，撰写一篇 PS 初稿，面向申请 {{school_name}}。

论证框架（已由用户确认，必须严格遵守）：
{{outline_summary}}

要求：
1. 严格按论证框架的主线、论点和结尾方向展开，不得新增或删除核心论点。
2. 只使用”事实白名单”中的具体事实，不得编造。
3. 如果资料中没有 school_specific_info，不要编造院校细节。
4. 保持自然、真实的表达风格，避免模板腔。
5. 只输出成稿正文，不要解释和注释。

附加要求：{{query_text}}
补充备注：{{notes}}

{{grounding_block}}

结构化资料：
{{profile_json}}
```
