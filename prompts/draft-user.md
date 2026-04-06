# Draft User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{query_text}}`
- `{{notes}}`
- `{{grounding_block}}`
- `{{profile_json}}`

```text
请根据下列结构化学生资料，撰写一篇 800-1000 词的英文个人陈述初稿，面向申请 {{school_name}} 的高中或本科申请场景。

要求：
1. 开篇完成自然自我介绍，尽量明确学生姓名、当前学校/年级；若资料缺失，不要编造，可弱化表达。
2. 明确写出两个学术兴趣方向，并使用 "primary interest" 与 "secondary interest" 进行标注。
3. 主体必须明确写出至少 3 个来自 experiences / achievements / basic profile 的具体事实，不能只写空泛感受。
4. 如果资料中存在 school_specific_info，可据此写 why school；如果没有，就只能做克制表达，不能编造教授、课程、项目、实验室、校园资源或录取偏好。
5. 必须保留真实、温暖、克制的高中生语气，不要过度成熟，不要模板化。
6. 严禁新增、虚构、夸大任何事实。任何不在“事实白名单”里的具体信息都不要写。
7. 如果初稿里出现 unsupported detail，宁可删掉，也不要猜测替代事实。
8. 只输出英文初稿正文，不要解释。

写作前请先在心里完成以下检查，但不要把检查过程写出来：
- 每个具体事实都必须能在白名单中找到依据。
- 至少有 2-4 处句子直接落到学生真实经历、项目、奖项或学校/年级信息。
- target school 必须出现。
- 如果资料只确认了一个兴趣方向，secondary interest 可以与 primary interest 相同，绝不能临时编造第二方向。

附加润色要求：{{query_text}}
补充备注：{{notes}}

{{grounding_block}}

结构化资料：
{{profile_json}}
```
