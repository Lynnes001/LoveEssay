# Rewrite User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{notes}}`
- `{{draft_text}}`

```text
请对下面这篇英文个人陈述进行文笔润色，不得改动任何事实、细节或内容。

要求：
1. 只调整语言风格、语气、措辞和句子流畅度。
2. 不得增加、删除或改变任何事实、事件或观点。
3. 保持高中生真实表达水平，自然、温暖、克制。
4. 只输出最终英文成稿，不附加任何说明。

目标学校：{{school_name}}
补充备注：{{notes}}

英文初稿：
{{draft_text}}
```
