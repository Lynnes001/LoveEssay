# Repair User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{query_text}}`
- `{{notes}}`
- `{{issues_json}}`
- `{{grounding_block}}`
- `{{profile_json}}`
- `{{essay_text}}`

```text
请根据下面的问题列表，修复这篇英文文书。

要求：
1. 必须修复所有 hard issues。
2. soft warnings 尽量弱化，但如果会伤害流畅度，可以保留克制、抽象、非事实型表达。
3. 优先把篇幅收敛到 800-1000 词；如果难以完全命中，也要先保证事实正确和结构完整。
4. 保留 primary interest 和 secondary interest。
5. 至少明确写出 3 个来自资料的具体事实，避免空泛叙述。
6. 你可以局部重写，也可以整篇重写；当前文书只是待修复草稿，不是必须保留的真相来源。
7. 对每个 unsupported claim，要么删除，要么替换成白名单中的真实事实，绝不能保留半真半假的表述。
8. 如果资料只确认了一个兴趣方向，secondary interest 可以与 primary interest 相同，不要新增第二方向。
9. 只输出修复后的英文正文。

目标学校：{{school_name}}
补充要求：{{query_text}}
补充备注：{{notes}}
问题列表：
{{issues_json}}

{{grounding_block}}

结构化资料：
{{profile_json}}

待修复文书：
{{essay_text}}
```
