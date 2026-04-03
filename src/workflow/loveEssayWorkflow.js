import { entrypoint, task } from '@langchain/langgraph';
import { config } from '../config.js';
import { annotateTaskError } from '../services/taskFailure.js';
import { createTraceable } from '../services/tracing.js';
import {
  appendTaskEvent,
  isTaskCancellationRequested,
  updateTaskArtifacts,
  updateTaskStep
} from '../services/taskStore.js';
import { TaskCancelledError } from '../services/errors.js';
import { parseDocx, segmentIntoSections, buildChunksFromSections } from './document.js';
import { callDashScopeChat, callDashScopeJson } from './modelClient.js';
import {
  buildDraftPrompt,
  buildExtractionPrompt,
  buildFactCheckPrompt,
  buildRepairPrompt,
  buildRewritePrompt,
  DRAFT_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  FACT_CHECK_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT
} from './prompts.js';
import { countWords, dedupeObjects, dedupeStrings, truncate } from './utils.js';

async function ensureNotCanceled(taskId) {
  if (await isTaskCancellationRequested(taskId)) {
    throw new TaskCancelledError();
  }
}

async function logStep(taskId, step, message, payload = null, updateStep = true) {
  if (updateStep) {
    await updateTaskStep(taskId, step);
  }
  await appendTaskEvent(taskId, step, 'info', message, payload);
}

const parseDocxTask = task('parse_docx', async ({ taskId, filePath }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'parse_docx', '开始解析 Word 材料');
  try {
    const parsed = await parseDocx(filePath);
    await appendTaskEvent(taskId, 'parse_docx', 'info', 'Word 材料解析完成', {
      characters: parsed.content.length
    });
    return parsed;
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'parse_docx',
      publicMessage: 'Word 材料解析失败',
      details: {
        file_path: filePath
      }
    });
  }
});

const segmentTask = task('segment_material', async ({ taskId, text }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'segment_material', '开始切分材料');
  try {
    const sections = segmentIntoSections(text);
    const chunks = await buildChunksFromSections(sections);
    await appendTaskEvent(taskId, 'segment_material', 'info', '材料切分完成', {
      sections: sections.length,
      chunks: chunks.length
    });
    return { sections, chunks };
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'segment_material',
      publicMessage: '材料切分失败'
    });
  }
});

const extractFactsTask = task('extract_facts', async ({ taskId, schoolName, chunk, progressLabel }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, `extract_facts ${progressLabel}`, `开始抽取事实 ${progressLabel}`, {
    progress: progressLabel,
    section_type: chunk.section_type
  }, false);
  await updateTaskStep(taskId, `extract_facts ${progressLabel}`);
  let response;
  try {
    response = await callDashScopeJson({
      model: config.models.extract,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: buildExtractionPrompt({ schoolName, chunk }),
      temperature: 0.1
    });
  } catch (error) {
    await appendTaskEvent(taskId, 'extract_facts', 'error', '片段事实抽取 JSON 解析失败', {
      progress: progressLabel,
      section_type: chunk.section_type,
      error: error.message,
      raw_preview: truncate(error.rawText, 1200),
      repaired_preview: truncate(error.repairedText, 1200)
    });
    throw annotateTaskError(error, {
      step: 'extract_facts',
      publicMessage: '片段事实抽取失败',
      details: {
        progress: progressLabel,
        section_type: chunk.section_type,
        chunk_index: chunk.chunk_index
      }
    });
  }
  await appendTaskEvent(taskId, 'extract_facts', 'info', '片段事实抽取完成', {
    progress: progressLabel,
    section_type: chunk.section_type,
    chunk_index: chunk.chunk_index
  });
  return response.json;
});

function mergeProfile(extractions, notes) {
  const studentNames = dedupeStrings(extractions.map((item) => item.student_name).filter(Boolean));
  const currentSchools = dedupeStrings(extractions.map((item) => item.current_school).filter(Boolean));
  const currentGrades = dedupeStrings(extractions.map((item) => item.current_grade).filter(Boolean));
  const intendedInterests = dedupeStrings(extractions.flatMap((item) => item.intended_interests || []));
  const experiences = dedupeObjects(
    extractions.flatMap((item) => item.experiences || []),
    (item) => `${String(item.category || '').toLowerCase()}::${String(item.title || '').toLowerCase()}::${String(item.detail || '').toLowerCase()}`
  );
  const achievements = dedupeObjects(
    extractions.flatMap((item) => item.achievements || []),
    (item) => `${String(item.title || '').toLowerCase()}::${String(item.detail || '').toLowerCase()}`
  );
  const schoolSpecificInfo = dedupeStrings(extractions.flatMap((item) => item.school_specific_info || []));
  const parentNotes = dedupeStrings(extractions.flatMap((item) => item.parent_notes || []));
  const constraints = dedupeStrings(extractions.flatMap((item) => item.constraints || []));
  const noteText = String(notes || '').trim();

  return {
    student_name: studentNames[0] || null,
    current_school: currentSchools[0] || null,
    current_grade: currentGrades[0] || null,
    intended_interests: intendedInterests,
    experiences,
    achievements,
    school_specific_info: schoolSpecificInfo,
    parent_notes: noteText ? dedupeStrings([...parentNotes, noteText]) : parentNotes,
    constraints: noteText ? dedupeStrings([...constraints, '请同时遵守用户补充备注']) : constraints
  };
}

const mergeProfileTask = task('merge_profile', async ({ taskId, sections, extractions, notes }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'merge_profile', '开始合并结构化资料');
  try {
    const profile = mergeProfile(extractions, notes);
    await updateTaskArtifacts(taskId, {
      profile,
      sections: {
        count: sections.length,
        preview: sections.slice(0, 8).map((section) => ({
          id: section.id,
          type: section.type,
          preview: truncate(section.content, 240)
        }))
      }
    });
    return profile;
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'merge_profile',
      publicMessage: '结构化资料合并失败'
    });
  }
});

const profileGuardTask = task('profile_guard', async ({ taskId, profile }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'profile_guard', '检查资料完整性');

  try {
    if (profile.experiences.length === 0 && profile.achievements.length === 0) {
      throw new Error('上传的 Word 材料缺少足够的学生经历，暂时无法生成文书');
    }

    if (profile.intended_interests.length === 0) {
      throw new Error('上传的 Word 材料未能识别出明确的兴趣方向，请补充专业兴趣或课程信息');
    }

    return {
      warnings: profile.school_specific_info.length === 0 ? ['未识别到明确的校本信息，why school 段落会保持克制'] : []
    };
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'profile_guard',
      publicMessage: error.message
    });
  }
});

const draftEssayTask = task('draft_essay', async ({ taskId, schoolName, queryText, notes, profile }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'draft_essay', '开始生成英文初稿');
  try {
    const response = await callDashScopeChat({
      model: config.models.draft,
      systemPrompt: DRAFT_SYSTEM_PROMPT,
      userPrompt: buildDraftPrompt({ schoolName, queryText, notes, profile }),
      temperature: 0.35
    });
    return response.text;
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'draft_essay',
      publicMessage: '生成英文初稿失败'
    });
  }
});

const rewriteEssayTask = task('rewrite_essay', async ({ taskId, schoolName, queryText, notes, profile, draftText }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'rewrite_essay', '开始优化语言风格');
  try {
    const response = await callDashScopeChat({
      model: config.models.rewrite,
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userPrompt: buildRewritePrompt({ schoolName, queryText, notes, profile, draftText }),
      temperature: 0.25
    });
    return response.text;
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'rewrite_essay',
      publicMessage: '优化英文成稿失败'
    });
  }
});

const factCheckTask = task('fact_check', async ({ taskId, schoolName, profile, essayText, stageLabel = 'essay' }) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'fact_check', `开始核查事实一致性（${stageLabel}）`, { stage: stageLabel });
  let response;
  try {
    response = await callDashScopeJson({
      model: config.models.check,
      systemPrompt: FACT_CHECK_SYSTEM_PROMPT,
      userPrompt: buildFactCheckPrompt({ profile, essayText, schoolName }),
      temperature: 0.1
    });
  } catch (error) {
    await appendTaskEvent(taskId, 'fact_check', 'error', '事实核查 JSON 解析失败', {
      error: error.message,
      raw_preview: truncate(error.rawText, 1200),
      repaired_preview: truncate(error.repairedText, 1200)
    });
    throw annotateTaskError(error, {
      step: 'fact_check',
      publicMessage: '事实核查失败',
      details: {
        stage: stageLabel
      }
    });
  }
  return response.json;
});

const repairEssayTask = task('repair_essay', async ({
  taskId,
  schoolName,
  queryText,
  notes,
  profile,
  essayText,
  issues,
  stageLabel = 'essay',
  attempt = 1
}) => {
  await ensureNotCanceled(taskId);
  await logStep(taskId, 'repair_essay', `发现约束问题，开始修复文书（${stageLabel} 第 ${attempt} 次）`, {
    stage: stageLabel,
    attempt
  });
  try {
    const response = await callDashScopeChat({
      model: config.models.rewrite,
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userPrompt: buildRepairPrompt({ schoolName, queryText, notes, profile, essayText, issues }),
      temperature: 0.15
    });
    return response.text;
  } catch (error) {
    throw annotateTaskError(error, {
      step: 'repair_essay',
      publicMessage: '文书修复失败',
      details: {
        stage: stageLabel,
        attempt
      }
    });
  }
});

function normalizeFactCheckResult(result) {
  const hardUnsupportedClaims = dedupeStrings([
    ...(result?.hard_unsupported_claims || []),
    ...(result?.unsupported_claims || [])
  ]);
  const softRiskClaims = dedupeStrings([
    ...(result?.soft_risk_claims || []),
    ...(result?.soft_school_risk_claims || []),
    ...(result?.school_risk_claims || [])
  ]);
  const missingRequiredElements = dedupeStrings(result?.missing_required_elements || []);
  const notes = dedupeStrings(result?.notes || []);

  return {
    ok: hardUnsupportedClaims.length === 0 && missingRequiredElements.length === 0,
    hard_unsupported_claims: hardUnsupportedClaims,
    soft_risk_claims: softRiskClaims,
    soft_school_risk_claims: softRiskClaims,
    missing_required_elements: missingRequiredElements,
    notes,
    hard_issue_count: hardUnsupportedClaims.length + missingRequiredElements.length,
    soft_issue_count: softRiskClaims.length
  };
}

function needsRepair({ factCheck, constraints }) {
  return (
    !factCheck.ok ||
    !constraints.ok ||
    factCheck.soft_issue_count > 0 ||
    constraints.soft_warnings.length > 0
  );
}

function checkConstraints(essayText, schoolName) {
  const wordCount = countWords(essayText);
  const text = String(essayText || '');
  const hardIssues = [];
  const softWarnings = [];

  if (wordCount < 700 || wordCount > 1100) {
    hardIssues.push(`词数严重偏离目标范围（期望 800-1000，当前 ${wordCount}）`);
  } else if (wordCount < 800 || wordCount > 1000) {
    softWarnings.push(`词数未命中目标范围（期望 800-1000，当前 ${wordCount}）`);
  }

  if (!/primary interest/i.test(text)) {
    hardIssues.push('缺少 primary interest 标识');
  }

  if (!/secondary interest/i.test(text)) {
    hardIssues.push('缺少 secondary interest 标识');
  }

  if (!new RegExp(String(schoolName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
    hardIssues.push('未提及目标学校');
  }

  return {
    ok: hardIssues.length === 0,
    word_count: wordCount,
    hard_issues: hardIssues,
    soft_warnings: softWarnings
  };
}

async function validateEssay({ taskId, schoolName, profile, essayText, stageLabel }) {
  const factCheck = normalizeFactCheckResult(await factCheckTask({
    taskId,
    schoolName,
    profile,
    essayText,
    stageLabel
  }));
  const constraints = checkConstraints(essayText, schoolName);

  await appendTaskEvent(taskId, 'essay_validation', 'info', `${stageLabel} 校验完成`, {
    stage: stageLabel,
    fact_check: factCheck,
    constraints
  });

  return {
    factCheck,
    constraints,
    needsRepair: needsRepair({ factCheck, constraints })
  };
}

async function repairEssayUntilSettled({
  taskId,
  schoolName,
  queryText,
  notes,
  profile,
  essayText,
  stageLabel,
  maxAttempts
}) {
  let currentEssay = essayText;
  let validation = await validateEssay({
    taskId,
    schoolName,
    profile,
    essayText: currentEssay,
    stageLabel: `${stageLabel}_initial`
  });
  let repairAttempts = 0;

  while (repairAttempts < maxAttempts && validation.needsRepair) {
    repairAttempts += 1;
    currentEssay = await repairEssayTask({
      taskId,
      schoolName,
      queryText,
      notes,
      profile,
      essayText: currentEssay,
      issues: {
        stage: stageLabel,
        attempt: repairAttempts,
        fact_check: validation.factCheck,
        constraints: validation.constraints
      },
      stageLabel,
      attempt: repairAttempts
    });

    validation = await validateEssay({
      taskId,
      schoolName,
      profile,
      essayText: currentEssay,
      stageLabel: `${stageLabel}_repair_${repairAttempts}`
    });
  }

  return {
    essay: currentEssay,
    factCheck: validation.factCheck,
    constraints: validation.constraints,
    repairAttempts
  };
}

const workflow = entrypoint({ name: 'loveEssayWorkflow' }, async (input) => {
  const startedAt = Date.now();
  const parsed = await parseDocxTask({ taskId: input.taskId, filePath: input.filePath });
  const segmented = await segmentTask({ taskId: input.taskId, text: parsed.content });

  const extractions = [];
  for (const [index, chunk] of segmented.chunks.entries()) {
    const progressLabel = `${index + 1}/${segmented.chunks.length}`;
    extractions.push(
      await extractFactsTask({
        taskId: input.taskId,
        schoolName: input.schoolName,
        chunk,
        progressLabel
      })
    );
  }

  const profile = await mergeProfileTask({
    taskId: input.taskId,
    sections: segmented.sections,
    extractions,
    notes: input.notes
  });

  const guard = await profileGuardTask({
    taskId: input.taskId,
    profile
  });

  let draftEssay = await draftEssayTask({
    taskId: input.taskId,
    schoolName: input.schoolName,
    queryText: input.queryText,
    notes: input.notes,
    profile
  });

  const draftStage = await repairEssayUntilSettled({
    taskId: input.taskId,
    schoolName: input.schoolName,
    queryText: input.queryText,
    notes: input.notes,
    profile,
    essayText: draftEssay,
    stageLabel: 'draft',
    maxAttempts: 1
  });

  let essay = await rewriteEssayTask({
    taskId: input.taskId,
    schoolName: input.schoolName,
    queryText: input.queryText,
    notes: input.notes,
    profile,
    draftText: draftStage.essay
  });

  const finalStage = await repairEssayUntilSettled({
    taskId: input.taskId,
    schoolName: input.schoolName,
    queryText: input.queryText,
    notes: input.notes,
    profile,
    essayText: essay,
    stageLabel: 'final',
    maxAttempts: 2
  });

  essay = finalStage.essay;
  const factCheck = finalStage.factCheck;
  const constraints = finalStage.constraints;

  if (!factCheck.ok || !constraints.ok) {
    await appendTaskEvent(input.taskId, 'final_validation', 'error', '修复后仍未满足最终约束', {
      fact_check: factCheck,
      constraints
    });
    throw annotateTaskError(
      new Error('文书在修复后仍未通过事实核查或格式约束，请调整材料或提示词后重试'),
      {
        step: 'final_validation',
        publicMessage: '文书最终校验失败',
        details: {
          fact_check: factCheck,
          constraints
        }
      }
    );
  }

  const metrics = {
    section_count: segmented.sections.length,
    chunk_count: segmented.chunks.length,
    extraction_count: extractions.length,
    word_count: constraints.word_count,
    guard_warnings: guard.warnings,
    draft_repair_attempts: draftStage.repairAttempts,
    final_repair_attempts: finalStage.repairAttempts,
    fact_check: factCheck,
    constraint_warnings: constraints.soft_warnings,
    elapsed_ms: Date.now() - startedAt
  };

  await updateTaskArtifacts(input.taskId, {
    profile,
    metrics
  });

  return {
    text: essay,
    profile,
    metrics
  };
});

const invokeWorkflow = createTraceable(
  async (input) => workflow.invoke(input),
  {
    name: 'LoveEssay Workflow',
    run_type: 'chain'
  }
);

export async function runLoveEssayWorkflow(input) {
  return invokeWorkflow(input);
}
