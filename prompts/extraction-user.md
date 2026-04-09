# Extraction User Prompt

Source: `src/workflow/prompts.js`

Type: `user`

Variables:

- `{{school_name}}`
- `{{chunk_section_type}}`
- `{{chunk_content}}`

```text
你正在处理一份申请材料的一个片段。材料可能混合：
- 学生简历/活动列表
- 学校说明
- 家长补充
- 其他背景说明

目标学校：{{school_name}}
当前片段类型提示：{{chunk_section_type}}

请严格只根据下面片段提取事实，不得脑补。输出 JSON，字段必须存在：
{
  "student_name": string | null,
  "current_school": string | null,
  "current_grade": string | null,
  "intended_interests": string[],
  "experiences": [{"category": string, "title": string, "detail": string}],
  "achievements": [{"title": string, "detail": string}],
  "school_specific_info": string[],
  "parent_notes": string[],
  "constraints": string[],
  "source_summary": string
}

提取规则：
1. school_specific_info 只收录片段中明确出现的学校相关信息。
2. parent_notes 只收录明显是家长/第三方补充的信息。
3. constraints 用于记录“不确定”“待核实”“不要夸大”这类约束。
4. experiences 和 achievements 可以为空数组，但字段不能缺失。

材料片段：
{{chunk_content}}
```
