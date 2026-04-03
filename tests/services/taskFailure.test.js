import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTaskFailureDetails } from '../../src/services/taskFailure.js';

test('buildTaskFailureDetails keeps structured context for task logging', () => {
  const error = new Error('模型请求失败 (502)');
  error.name = 'DashScopeApiError';
  error.status = 502;
  error.responseBody = { error: { message: 'upstream overloaded' } };
  error.taskStep = 'draft_essay';
  error.taskPublicMessage = '生成英文初稿失败';
  error.rawText = '{"bad":true}';

  const details = buildTaskFailureDetails(error, {
    stage: 'draft',
    taskId: 'task-123'
  });

  assert.equal(details.publicMessage, '生成英文初稿失败');
  assert.equal(details.event.step, 'draft_essay');
  assert.equal(details.event.payload.error_name, 'DashScopeApiError');
  assert.equal(details.event.payload.status, 502);
  assert.match(details.event.payload.stack_preview, /Error: 模型请求失败/);
  assert.equal(details.event.payload.stage, 'draft');
  assert.equal(details.event.payload.raw_preview, '{"bad":true}');
  assert.deepEqual(details.event.payload.response_body, { error: { message: 'upstream overloaded' } });
});
