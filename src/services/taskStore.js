import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { config } from '../config.js';

function rowToTask(row) {
  if (!row) {
    return null;
  }

  return {
    task_id: row.id,
    status: row.status,
    school_name: row.school_name,
    query: row.query,
    notes: row.notes,
    material_file_name: row.material_file_name,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    updated_at: row.updated_at,
    current_step: row.current_step,
    cancel_requested: row.cancel_requested,
    error: row.error_message,
    text: row.result_text,
    profile: row.profile_json,
    metrics: row.metrics_json
  };
}

export async function createTask({
  schoolName,
  queryText,
  notes,
  file,
  requestIp
}) {
  const taskId = randomUUID();
  const result = await query(
    `INSERT INTO tasks (
      id,
      status,
      school_name,
      query,
      notes,
      material_file_name,
      material_file_path,
      material_mime_type,
      material_file_size,
      request_ip,
      workflow_version
    ) VALUES ($1, 'queued', $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      taskId,
      schoolName,
      queryText,
      notes,
      file.originalname,
      file.path,
      file.mimetype,
      file.size,
      requestIp,
      config.workflowVersion
    ]
  );

  return rowToTask(result.rows[0]);
}

export async function getTask(taskId) {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  return rowToTask(result.rows[0]);
}

export async function getTaskRecord(taskId) {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0] || null;
}

export async function appendTaskEvent(taskId, step, level, message, payload = null) {
  await query(
    `INSERT INTO task_events (task_id, step, level, message, payload)
    VALUES ($1, $2, $3, $4, $5)`,
    [taskId, step, level, message, payload]
  );
}

export async function markTaskRunning(taskId, currentStep = 'starting') {
  await query(
    `UPDATE tasks
    SET status = 'running',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW(),
        current_step = $2,
        error_message = NULL
    WHERE id = $1`,
    [taskId, currentStep]
  );
}

export async function updateTaskStep(taskId, currentStep) {
  await query(
    `UPDATE tasks
    SET current_step = $2,
        updated_at = NOW()
    WHERE id = $1`,
    [taskId, currentStep]
  );
}

export async function updateTaskArtifacts(taskId, artifacts) {
  await query(
    `UPDATE tasks
    SET profile_json = COALESCE($2, profile_json),
        sections_json = COALESCE($3, sections_json),
        metrics_json = COALESCE($4, metrics_json),
        updated_at = NOW()
    WHERE id = $1`,
    [taskId, artifacts.profile ?? null, artifacts.sections ?? null, artifacts.metrics ?? null]
  );
}

export async function markTaskCompleted(taskId, { resultText, profile, metrics }) {
  await query(
    `UPDATE tasks
    SET status = 'completed',
        result_text = $2,
        profile_json = $3,
        metrics_json = $4,
        current_step = 'completed',
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = $1`,
    [taskId, resultText, profile, metrics]
  );
}

export async function markTaskFailed(taskId, message) {
  await query(
    `UPDATE tasks
    SET status = 'failed',
        error_message = $2,
        current_step = 'failed',
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = $1`,
    [taskId, message]
  );
}

export async function markTaskCanceled(taskId, message = '任务已取消') {
  await query(
    `UPDATE tasks
    SET status = 'canceled',
        cancel_requested = TRUE,
        error_message = $2,
        current_step = 'canceled',
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = $1`,
    [taskId, message]
  );
}

export async function requestTaskCancel(taskId) {
  await query(
    `UPDATE tasks
    SET cancel_requested = TRUE,
        updated_at = NOW()
    WHERE id = $1`,
    [taskId]
  );
}

export async function isTaskCancellationRequested(taskId) {
  const result = await query('SELECT cancel_requested FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0]?.cancel_requested === true;
}

export async function cleanupExpiredTasks() {
  await query(
    `DELETE FROM tasks
    WHERE finished_at IS NOT NULL
      AND finished_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')`,
    [config.taskTtlMs]
  );
}
