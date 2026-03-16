const crypto = require('crypto');
const express = require('express');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 6789);
const WORKFLOW_APP_ID = process.env.WORKFLOW_APP_ID || '6e42604f098e49de9ac0536571b47926';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const TASK_TIMEOUT_MS = Number(process.env.TASK_TIMEOUT_MS || 300000);
const TASK_TTL_MS = Number(process.env.TASK_TTL_MS || 2 * 60 * 60 * 1000);
const RESULT_ACCESS_TTL_SECONDS = Number(process.env.RESULT_ACCESS_TTL_SECONDS || 1800);
const RESULT_COOKIE_NAME = 'loveessay_task';

app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));

const ipBuckets = new Map();
const tasks = new Map();

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const nowMinute = Math.floor(Date.now() / 60000);
  const bucket = ipBuckets.get(ip);

  if (!bucket || bucket.minute !== nowMinute) {
    ipBuckets.set(ip, { minute: nowMinute, count: 1 });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  bucket.count += 1;
  return next();
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function setResultAccessCookie(res, taskId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${RESULT_COOKIE_NAME}=${encodeURIComponent(taskId)}; Max-Age=${RESULT_ACCESS_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearResultAccessCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${RESULT_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
  );
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return '请求体必须是 JSON 对象';
  }

  const schoolName = String(payload.school_name || '').trim();
  const studentInfo = String(payload.student_info_str || '').trim();

  if (!schoolName) {
    return 'school_name 不能为空';
  }

  if (!studentInfo) {
    return 'student_info_str 不能为空';
  }

  if (schoolName.length > 100) {
    return 'school_name 长度不能超过 100';
  }

  if (studentInfo.length > 10000) {
    return 'student_info_str 长度不能超过 10000';
  }

  const query = String(payload.query || '').trim();
  if (query.length > 500) {
    return 'query 长度不能超过 500';
  }

  return null;
}

function buildPayload(input) {
  return {
    school_name: String(input.school_name).trim(),
    student_info_str: String(input.student_info_str).trim(),
    query: String(input.query || '').trim() || '请润色以下文书'
  };
}

function extractTextFromOutput(output) {
  if (!output) {
    return '';
  }

  if (typeof output === 'string') {
    return output;
  }

  if (typeof output.text === 'string') {
    return output.text;
  }

  if (typeof output.result === 'string') {
    return output.result;
  }

  if (typeof output.content === 'string') {
    return output.content;
  }

  for (const key of Object.keys(output)) {
    if (typeof output[key] === 'string' && output[key].trim()) {
      return output[key];
    }
  }

  return '';
}

function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.res === 'string' && parsed.res.trim()) {
        return parsed.res;
      }
      if (typeof parsed.text === 'string' && parsed.text.trim()) {
        return parsed.text;
      }
      if (typeof parsed.content === 'string' && parsed.content.trim()) {
        return parsed.content;
      }
    }
  } catch (e) {
    // keep original text
  }

  return trimmed;
}

function buildPrompt(payload) {
  return [
    `目标学校：${payload.school_name}`,
    '',
    '学生信息：',
    payload.student_info_str,
    '',
    `润色要求：${payload.query}`
  ].join('\n');
}

function buildAppRequestBody(payload, stream) {
  return {
    input: {
      prompt: buildPrompt(payload),
      biz_params: {
        school_name: payload.school_name,
        student_info_str: payload.student_info_str,
        query: payload.query
      }
    },
    parameters: stream
      ? {
          incremental_output: true,
          flow_stream_mode: 'agent_format'
        }
      : {},
    debug: {}
  };
}

function createHttpError(status, message, requestId) {
  const error = new Error(message);
  error.status = status;
  error.requestId = requestId || null;
  return error;
}

async function callDashScopeCompletion(payload, signal) {
  if (!DASHSCOPE_API_KEY) {
    throw createHttpError(500, '服务端未配置 DASHSCOPE_API_KEY');
  }

  const upstreamUrl = `https://dashscope.aliyuncs.com/api/v1/apps/${WORKFLOW_APP_ID}/completion`;
  const upstreamResp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildAppRequestBody(payload, false)),
    signal
  });

  const raw = await upstreamResp.json().catch(() => ({}));
  const requestId = raw.request_id || raw.requestId;

  if (!upstreamResp.ok) {
    const message =
      (raw && raw.message) ||
      (raw && raw.code ? `DashScope 错误: ${raw.code}` : '') ||
      `上游请求失败 (${upstreamResp.status})`;
    throw createHttpError(upstreamResp.status, message, requestId);
  }

  const text = normalizeText(extractTextFromOutput(raw.output));
  if (!text) {
    throw createHttpError(502, '上游返回成功但未提取到文本结果', requestId);
  }

  return { text, requestId };
}

function serializeTask(task) {
  return {
    task_id: task.id,
    status: task.status,
    school_name: task.payload.school_name,
    student_info_str: task.payload.student_info_str,
    created_at: task.createdAt,
    started_at: task.startedAt,
    finished_at: task.finishedAt,
    request_id: task.requestId,
    error: task.error,
    text: task.status === 'completed' ? task.text : null
  };
}

async function executeTask(task) {
  if (task.status !== 'queued') {
    return;
  }

  if (task.cancelRequested) {
    task.status = 'canceled';
    task.error = '生成已停止';
    task.finishedAt = Date.now();
    task.updatedAt = task.finishedAt;
    return;
  }

  task.status = 'running';
  task.startedAt = Date.now();
  task.updatedAt = task.startedAt;
  task.error = null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
  task.abortController = controller;

  try {
    const result = await callDashScopeCompletion(task.payload, controller.signal);
    task.text = result.text;
    task.requestId = result.requestId;
    task.status = 'completed';
  } catch (error) {
    if (task.cancelRequested || (error && error.name === 'AbortError')) {
      task.status = 'canceled';
      task.error = '生成已停止';
    } else {
      task.status = 'failed';
      task.error = error.message || '调用上游服务失败';
      task.requestId = error.requestId || null;
    }
  } finally {
    clearTimeout(timeout);
    task.abortController = null;
    task.updatedAt = Date.now();
    task.finishedAt = Date.now();
  }
}

function createTask(payload) {
  const task = {
    id: crypto.randomUUID(),
    payload,
    status: 'queued',
    text: '',
    error: null,
    requestId: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    updatedAt: Date.now(),
    cancelRequested: false,
    abortController: null
  };

  tasks.set(task.id, task);
  setImmediate(() => {
    executeTask(task).catch((error) => {
      task.status = 'failed';
      task.error = error.message || '任务执行失败';
      task.finishedAt = Date.now();
      task.updatedAt = task.finishedAt;
      task.abortController = null;
    });
  });

  return task;
}

function findTask(taskId) {
  if (!taskId) {
    return null;
  }
  return tasks.get(String(taskId).trim()) || null;
}

function cleanupTasks() {
  const now = Date.now();
  for (const [taskId, task] of tasks.entries()) {
    const anchor = task.finishedAt || task.createdAt;
    if (now - anchor > TASK_TTL_MS) {
      tasks.delete(taskId);
    }
  }
}

setInterval(cleanupTasks, 10 * 60 * 1000).unref();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/result.html', (req, res) => {
  const cookies = parseCookies(req);
  const taskId = String(req.query.task || cookies[RESULT_COOKIE_NAME] || '').trim();
  const task = findTask(taskId);

  if (!task) {
    clearResultAccessCookie(res);
    return res.redirect('/index.html');
  }

  setResultAccessCookie(res, task.id);
  return res.sendFile(path.join(__dirname, 'result.html'));
});

app.use(express.static('.', { index: false }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'loveessay-proxy' });
});

app.post('/api/tasks', rateLimit, (req, res) => {
  if (!DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 DASHSCOPE_API_KEY' });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const payload = buildPayload(req.body);
  const task = createTask(payload);

  setResultAccessCookie(res, task.id);
  return res.status(202).json(serializeTask(task));
});

app.get('/api/tasks/:taskId', (req, res) => {
  const task = findTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: '任务不存在或已过期' });
  }

  return res.json(serializeTask(task));
});

app.post('/api/tasks/:taskId/cancel', rateLimit, (req, res) => {
  const task = findTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: '任务不存在或已过期' });
  }

  if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
    return res.json(serializeTask(task));
  }

  task.cancelRequested = true;
  task.updatedAt = Date.now();
  if (task.abortController) {
    task.status = 'canceled';
    task.error = '生成已停止';
    task.finishedAt = Date.now();
    task.abortController.abort();
  } else {
    task.status = 'canceled';
    task.error = '生成已停止';
    task.finishedAt = Date.now();
  }

  return res.json(serializeTask(task));
});

app.post('/api/polish', rateLimit, async (req, res) => {
  if (!DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 DASHSCOPE_API_KEY' });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const payload = buildPayload(req.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);

  try {
    const result = await callDashScopeCompletion(payload, controller.signal);
    return res.json({ text: result.text, request_id: result.requestId });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    return res.status(isTimeout ? 504 : error.status || 500).json({
      error: isTimeout ? '上游请求超时，请稍后重试' : error.message || '调用上游服务失败',
      request_id: error.requestId || null
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.post('/api/polish/stream', rateLimit, async (req, res) => {
  if (!DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 DASHSCOPE_API_KEY' });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const payload = buildPayload(req.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
  const upstreamUrl = `https://dashscope.aliyuncs.com/api/v1/apps/${WORKFLOW_APP_ID}/completion`;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write('event: status\ndata: {"status":"connecting","message":"已发起请求，正在连接阿里云工作流..."}\n\n');

  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable'
      },
      body: JSON.stringify(buildAppRequestBody(payload, true)),
      signal: controller.signal
    });

    if (!upstreamResp.ok) {
      const raw = await upstreamResp.json().catch(() => ({}));
      const requestId = raw.request_id || raw.requestId;
      const message =
        (raw && raw.message) ||
        (raw && raw.code ? `DashScope 错误: ${raw.code}` : '') ||
        `上游请求失败 (${upstreamResp.status})`;
      res.write(`event: error\ndata: ${JSON.stringify({ error: message, request_id: requestId })}\n\n`);
      return res.end();
    }

    res.write('event: status\ndata: {"status":"connected","message":"工作流已连接，正在等待模型返回内容..."}\n\n');

    if (!upstreamResp.body) {
      res.write('event: error\ndata: {"error":"上游无流式响应体"}\n\n');
      return res.end();
    }

    const reader = upstreamResp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res.write(decoder.decode(value, { stream: true }));
    }

    return res.end();
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    res.write(`event: error\ndata: ${JSON.stringify({ error: isTimeout ? '上游请求超时，请稍后重试' : '调用上游服务失败' })}\n\n`);
    return res.end();
  } finally {
    clearTimeout(timeout);
  }
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大，请缩短输入内容' });
  }

  return res.status(500).json({ error: '服务内部错误' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LoveEssay proxy running on 127.0.0.1:${PORT}`);
});
