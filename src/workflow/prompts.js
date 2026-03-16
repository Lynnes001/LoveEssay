export function buildExtractionPrompt({ schoolName, queryText, notes, chunk }) {
  return `
你正在处理一份申请材料的一个片段。材料可能混合：
- 学生简历/活动列表
- 学校说明
- 家长补充
- 其他背景说明

目标学校：${schoolName}
用户润色要求：${queryText || '未提供'}
补充备注：${notes || '未提供'}
当前片段类型提示：${chunk.section_type}

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
${chunk.content}
`.trim();
}

export const EXTRACTION_SYSTEM_PROMPT = `
你是一名申请材料结构化抽取助手。
你的唯一任务是把原始材料片段整理成严格 JSON。
不得生成解释文字，不得补充未出现的事实。
`.trim();

export function buildDraftPrompt({ schoolName, queryText, notes, profile }) {
  return `
请根据下列结构化学生资料，撰写一篇 800-1000 词的英文个人陈述初稿，面向申请 ${schoolName} 的高中或本科申请场景。

要求：
1. 开篇完成自然自我介绍，尽量明确学生姓名、当前学校/年级；若资料缺失，不要编造，可弱化表达。
2. 明确写出两个学术兴趣方向，并使用 "primary interest" 与 "secondary interest" 进行标注。
3. 主体需围绕真实经历展开，优先使用 experiences / achievements 中已有事实。
4. 如果资料中存在 school_specific_info，可据此写 why school；如果没有，就只能做克制表达，不能编造教授、课程、项目或校园资源。
5. 必须保留真实、温暖、克制的高中生语气，不要过度成熟，不要模板化。
6. 严禁新增、虚构、夸大任何事实。
7. 只输出英文初稿正文，不要解释。

附加润色要求：${queryText || '无'}
补充备注：${notes || '无'}

结构化资料：
${JSON.stringify(profile, null, 2)}
`.trim();
}

export const DRAFT_SYSTEM_PROMPT = `
You are an international school application essay writer.
Write authentic, specific, fact-grounded English personal statements for high-school-age applicants.
Never invent facts. Never add school-specific details unless they are present in the provided profile.
`.trim();

export function buildRewritePrompt({ schoolName, queryText, notes, profile, draftText }) {
  return `
请将下面这篇英文个人陈述初稿改写成最终成稿，保持 800-1000 词。

要求：
1. 保留全部关键事实，不得虚构。
2. 强化叙事结构、段落衔接、主题聚焦和说服力。
3. 保持高中生真实表达水平，自然、温暖、克制。
4. 保留 "primary interest" 与 "secondary interest" 的清晰标识。
5. 如果资料中缺少 school_specific_info，不要编造院校细节。
6. 只输出最终英文成稿。

目标学校：${schoolName}
补充要求：${queryText || '无'}
补充备注：${notes || '无'}

结构化资料：
${JSON.stringify(profile, null, 2)}

英文初稿：
${draftText}
`.trim();
}

export const REWRITE_SYSTEM_PROMPT = `
You are an essay rewriting assistant for admissions writing.
Your job is to improve structure, flow, and voice while preserving every factual claim from the source profile.
Return only the final English essay.
`.trim();

export function buildFactCheckPrompt({ profile, essayText, schoolName }) {
  return `
请核查下面这篇英文文书是否严格受限于给定资料，并把问题区分为“硬问题”和“软问题”。
输出 JSON：
{
  "hard_unsupported_claims": string[],
  "soft_school_risk_claims": string[],
  "missing_required_elements": string[],
  "notes": string[]
}

判定标准：
1. hard_unsupported_claims：必须是具体且可核验的事实性错误，例如新增经历、新增奖项、新增课程、新增研究、新增家庭背景、新增时间线事实。
2. soft_school_risk_claims：只记录较软的院校描述风险，例如泛化的学校优势、气质、跨学科氛围、资源丰富等未被资料明确支持的表述。此类问题不要升级为硬问题，除非它已经构成具体事实。
3. missing_required_elements：缺少 primary interest、secondary interest、目标学校名等硬性要素。
4. 如果文书只是使用了克制、抽象、非具体事实型的 why school 表达，不要判为 hard_unsupported_claims。
5. 返回 JSON 即可，不要附加解释文字。

目标学校：${schoolName}
结构化资料：
${JSON.stringify(profile, null, 2)}

待检查文书：
${essayText}
`.trim();
}

export const FACT_CHECK_SYSTEM_PROMPT = `
You are a factual compliance checker for admissions essays.
Return JSON only.
Separate hard factual errors from soft school-description risks.
`.trim();

export function buildRepairPrompt({ schoolName, queryText, notes, profile, essayText, issues }) {
  return `
请根据下面的问题列表，修复这篇英文文书。

要求：
1. 必须修复所有 hard issues。
2. soft warnings 尽量弱化，但如果会伤害流畅度，可以保留克制、抽象、非事实型表达。
3. 优先把篇幅收敛到 800-1000 词；如果难以完全命中，也要先保证事实正确和结构完整。
4. 保留 primary interest 和 secondary interest。
5. 只输出修复后的英文正文。

目标学校：${schoolName}
补充要求：${queryText || '无'}
补充备注：${notes || '无'}
问题列表：
${JSON.stringify(issues, null, 2)}

结构化资料：
${JSON.stringify(profile, null, 2)}

待修复文书：
${essayText}
`.trim();
}
