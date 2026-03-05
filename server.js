const express = require('express');

const app = express();

const PORT = Number(process.env.PORT || 6789);
const WORKFLOW_APP_ID = process.env.WORKFLOW_APP_ID || '6e42604f098e49de9ac0536571b47926';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);

app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));
app.use(express.static('.'));

const ipBuckets = new Map();

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
      school_name: payload.school_name,
      student_info_str: payload.student_info_str,
      query: payload.query
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'loveessay-proxy' });
});

app.post('/api/polish', rateLimit, async (req, res) => {
  if (!DASHSCOPE_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 DASHSCOPE_API_KEY' });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const payload = {
    school_name: String(req.body.school_name).trim(),
    student_info_str: String(req.body.student_info_str).trim(),
    query: String(req.body.query || '').trim() || '请润色以下文书'
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const upstreamUrl = `https://dashscope.aliyuncs.com/api/v1/apps/${WORKFLOW_APP_ID}/completion`;
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildAppRequestBody(payload, false)),
      signal: controller.signal
    });

    const raw = await upstreamResp.json().catch(() => ({}));
    const requestId = raw.request_id || raw.requestId;

    if (!upstreamResp.ok) {
      const message =
        (raw && raw.message) ||
        (raw && raw.code ? `DashScope 错误: ${raw.code}` : '') ||
        `上游请求失败 (${upstreamResp.status})`;
      return res.status(upstreamResp.status).json({ error: message, request_id: requestId });
    }

    const text = normalizeText(extractTextFromOutput(raw.output));
    if (!text) {
      return res.status(502).json({ error: '上游返回成功但未提取到文本结果', request_id: requestId });
    }

    return res.json({ text, request_id: requestId });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? '上游请求超时，请稍后重试' : '调用上游服务失败'
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

  const payload = {
    school_name: String(req.body.school_name).trim(),
    student_info_str: String(req.body.student_info_str).trim(),
    query: String(req.body.query || '').trim() || '请润色以下文书'
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);
  const upstreamUrl = `https://dashscope.aliyuncs.com/api/v1/apps/${WORKFLOW_APP_ID}/completion`;

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
      const message =
        (raw && raw.message) ||
        (raw && raw.code ? `DashScope 错误: ${raw.code}` : '') ||
        `上游请求失败 (${upstreamResp.status})`;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

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
