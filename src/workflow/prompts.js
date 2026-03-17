function uniqueNonEmpty(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function buildInterestPlan(profile) {
  const interests = uniqueNonEmpty(profile?.intended_interests || []);
  const primary = interests[0] || null;
  const secondary = interests[1] || interests[0] || null;

  return {
    primary,
    secondary,
    hasOnlyOneConfirmedInterest: interests.length <= 1
  };
}

function formatObjectList(items = [], formatter, emptyText = '- None') {
  if (!Array.isArray(items) || items.length === 0) {
    return emptyText;
  }

  return items.map((item, index) => `- ${index + 1}. ${formatter(item)}`).join('\n');
}

function buildGroundingBlock(profile) {
  const interestPlan = buildInterestPlan(profile);
  const lines = [
    '可用事实白名单（只能写这里明确存在的内容）:'
  ];

  if (profile?.student_name || profile?.current_school || profile?.current_grade) {
    lines.push('- Basic profile:');
    if (profile?.student_name) {
      lines.push(`  name = ${profile.student_name}`);
    }
    if (profile?.current_school) {
      lines.push(`  current_school = ${profile.current_school}`);
    }
    if (profile?.current_grade) {
      lines.push(`  current_grade = ${profile.current_grade}`);
    }
  }

  const interests = uniqueNonEmpty(profile?.intended_interests || []);
  if (interests.length > 0) {
    lines.push(`- Confirmed interests from materials: ${interests.join(' | ')}`);
  }

  lines.push(`- Suggested label for primary interest: ${interestPlan.primary || 'use only a confirmed interest from the profile'}`);
  lines.push(`- Suggested label for secondary interest: ${interestPlan.secondary || 'use only a confirmed interest from the profile'}`);
  if (interestPlan.hasOnlyOneConfirmedInterest && interestPlan.primary) {
    lines.push('- Important: the materials only confirm one interest direction. If you cannot support a second one, repeat the same confirmed direction instead of inventing a new field.');
  }

  lines.push('经历与活动:');
  lines.push(
    formatObjectList(
      profile?.experiences || [],
      (item) => `${item.category || 'experience'} | ${item.title || 'untitled'} | ${item.detail || 'no detail'}`
    )
  );

  lines.push('奖项与结果:');
  lines.push(
    formatObjectList(
      profile?.achievements || [],
      (item) => `${item.title || 'untitled'} | ${item.detail || 'no detail'}`
    )
  );

  if ((profile?.school_specific_info || []).length > 0) {
    lines.push('已确认的学校相关信息:');
    lines.push(formatObjectList(profile.school_specific_info, (item) => item));
  } else {
    lines.push('- No confirmed school-specific info. Any why-school content must stay abstract and restrained.');
  }

  if ((profile?.parent_notes || []).length > 0) {
    lines.push('补充备注与语气要求:');
    lines.push(formatObjectList(profile.parent_notes, (item) => item));
  }

  if ((profile?.constraints || []).length > 0) {
    lines.push('额外约束:');
    lines.push(formatObjectList(profile.constraints, (item) => item));
  }

  return lines.join('\n');
}

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
  const groundingBlock = buildGroundingBlock(profile);
  return `
请根据下列结构化学生资料，撰写一篇 800-1000 词的英文个人陈述初稿，面向申请 ${schoolName} 的高中或本科申请场景。

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

附加润色要求：${queryText || '无'}
补充备注：${notes || '无'}

${groundingBlock}

结构化资料：
${JSON.stringify(profile, null, 2)}
`.trim();
}

export const DRAFT_SYSTEM_PROMPT = `
You are an international school application essay writer.
Write authentic, specific, fact-grounded English personal statements for high-school-age applicants.
Never invent facts. Never add school-specific details unless they are present in the provided profile.
Every concrete claim in the essay must be traceable to the provided profile.
`.trim();

export function buildRewritePrompt({ schoolName, queryText, notes, profile, draftText }) {
  const groundingBlock = buildGroundingBlock(profile);
  return `
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

目标学校：${schoolName}
补充要求：${queryText || '无'}
补充备注：${notes || '无'}

${groundingBlock}

结构化资料：
${JSON.stringify(profile, null, 2)}

英文初稿：
${draftText}
`.trim();
}

export const REWRITE_SYSTEM_PROMPT = `
You are an essay rewriting assistant for admissions writing.
Your job is to improve structure, flow, and voice while keeping only facts supported by the source profile.
If the draft contains unsupported details, remove them or replace them with supported details from the profile.
Return only the final English essay.
`.trim();

export function buildFactCheckPrompt({ profile, essayText, schoolName }) {
  const groundingBlock = buildGroundingBlock(profile);
  return `
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

目标学校：${schoolName}
${groundingBlock}

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
Check the essay sentence by sentence against the provided profile.
`.trim();

export function buildRepairPrompt({ schoolName, queryText, notes, profile, essayText, issues }) {
  const groundingBlock = buildGroundingBlock(profile);
  return `
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

目标学校：${schoolName}
补充要求：${queryText || '无'}
补充备注：${notes || '无'}
问题列表：
${JSON.stringify(issues, null, 2)}

${groundingBlock}

结构化资料：
${JSON.stringify(profile, null, 2)}

待修复文书：
${essayText}
`.trim();
}
