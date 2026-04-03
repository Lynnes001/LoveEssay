import { truncate } from '../workflow/utils.js';

function toError(error) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error || '未知错误'));
}

function mergeDefined(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value !== undefined && value !== null && value !== '') {
      target[key] = value;
    }
  }
  return target;
}

export function annotateTaskError(error, { step, publicMessage, eventMessage, details } = {}) {
  const target = toError(error);

  if (step) {
    target.taskStep = step;
  }
  if (publicMessage) {
    target.taskPublicMessage = publicMessage;
  }
  if (eventMessage) {
    target.taskEventMessage = eventMessage;
  }
  if (details) {
    target.taskDetails = {
      ...(target.taskDetails || {}),
      ...details
    };
  }

  return target;
}

export function buildTaskFailureDetails(error, context = {}) {
  const target = toError(error);
  const payload = {};
  const step = target.taskStep || context.step || 'worker';
  const baseMessage = target.taskPublicMessage || context.publicMessage || target.message || '任务执行失败';

  mergeDefined(payload, target.taskDetails);
  mergeDefined(payload, context);

  delete payload.step;
  delete payload.publicMessage;
  delete payload.eventMessage;

  payload.error_name = target.name || 'Error';
  payload.error_message = target.message || '未知错误';

  if (target.stack) {
    payload.stack_preview = truncate(target.stack, 2400);
  }
  if (target.status) {
    payload.status = target.status;
  }
  if (target.model) {
    payload.model = target.model;
  }
  if (target.requestId) {
    payload.request_id = target.requestId;
  }
  if (target.rawText) {
    payload.raw_preview = truncate(target.rawText, 1200);
  }
  if (target.repairedText) {
    payload.repaired_preview = truncate(target.repairedText, 1200);
  }
  if (target.responseBody !== undefined) {
    payload.response_body = target.responseBody;
  }
  if (target.cause?.name) {
    payload.cause_name = target.cause.name;
  }
  if (target.cause?.message) {
    payload.cause_message = target.cause.message;
  }

  return {
    publicMessage: baseMessage,
    event: {
      step,
      level: 'error',
      message: target.taskEventMessage || context.eventMessage || baseMessage,
      payload
    }
  };
}
