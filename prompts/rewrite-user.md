# Rewrite User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{query_text}}`
- `{{notes}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{draft_text}}`

```text
请将下面这篇英文个人陈述初稿改写成最终成稿，保持 800-1000 词。

要求：
1. 保留全部关键事实，不得虚构。
2. 强化叙事结构、段落衔接、主题聚焦和说服力。
3. 保持高中生真实表达水平，自然、温暖、克制。
4. 保留 "primary interest" 与 "secondary interest" 的清晰标识。
5. 至少明确写出 3 个来自资料的具体事实，不能把文章写成空泛总结。
6. 如果初稿中出现任何不在 profile 里的细节，直接删除或改写为 profile 中真实存在的事实，不要继续保留。
7. 如果资料中缺少 school_specific_info，不要编造院校细节。
8. 只输出最终英文成稿。

目标学校：{{school_name}}
补充要求：{{query_text}}
补充备注：{{notes}}

{{grounding_block}}

结构化资料：
{{profile_json}}

英文初稿：
{{draft_text}}
```
