import express from 'express';
import path from 'node:path';
import { config } from './config.js';
import { healthcheckDb } from './db/pool.js';
import { clearAuthCookie, handleLogin, readAuthenticatedUser, requireAuth, setAuthCookie } from './services/auth.js';
import { ValidationError } from './services/errors.js';
import { rateLimit } from './services/rateLimit.js';
import { cancelQueuedJob, enqueueTask, healthcheckRedis } from './services/queue.js';
import { getTask, createTask, requestTaskCancel, markTaskCanceled } from './services/taskStore.js';
import { normalizeUploadOriginalName, removeUploadedFile, uploadMiddleware } from './services/uploads.js';

const app = express();
const staticAssetsDir = path.join(config.rootDir, 'assets');

app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/assets', express.static(staticAssetsDir, {
  fallthrough: false,
  maxAge: '7d'
}));

function validateTaskForm(body, file) {
  const schoolName = String(body.school_name || '').trim();
  const queryText = String(body.query || '').trim();
  const notes = String(body.notes || '').trim();

  if (!schoolName) {
    throw new ValidationError('school_name 不能为空');
  }

  if (schoolName.length > 120) {
    throw new ValidationError('school_name 长度不能超过 120');
  }

  if (queryText.length > 1000) {
    throw new ValidationError('query 长度不能超过 1000');
  }

  if (notes.length > 4000) {
    throw new ValidationError('notes 长度不能超过 4000');
  }

  if (!file) {
    throw new ValidationError('请上传 Word 材料文件');
  }

  return {
    schoolName,
    queryText: queryText || '请写出一篇真实、克制、具有说服力的英文个人陈述',
    notes
  };
}

app.get('/login', (req, res) => {
  const session = readAuthenticatedUser(req);
  if (session) {
    res.redirect(req.query.next ? String(req.query.next) : '/');
    return;
  }
  res.sendFile(path.join(config.rootDir, 'login.html'));
});

app.post('/api/auth/login', rateLimit, (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const nextUrl = String(req.body.next || '/').startsWith('/') ? String(req.body.next || '/') : '/';

  if (!handleLogin(username, password)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  setAuthCookie(res, username);
  res.json({ ok: true, redirect: nextUrl });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true, redirect: '/login' });
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(config.rootDir, 'index.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile(path.join(config.rootDir, 'index.html'));
});

app.get('/result.html', requireAuth, (req, res) => {
  res.sendFile(path.join(config.rootDir, 'result.html'));
});

app.use('/index.html', requireAuth);
app.use('/result.html', requireAuth);

app.get('/api/auth/session', (req, res) => {
  const session = readAuthenticatedUser(req);
  if (!session) {
    res.status(401).json({ error: '未登录' });
    return;
  }

  res.json({ ok: true, user: session.sub });
});

app.get('/api/health', async (req, res) => {
  try {
    await Promise.all([healthcheckDb(), healthcheckRedis()]);
    res.json({ ok: true, service: 'loveessay-web', workflow_version: config.workflowVersion });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message || 'healthcheck failed' });
  }
});

app.post('/api/tasks', requireAuth, rateLimit, uploadMiddleware.single('material_file'), async (req, res, next) => {
  try {
    if (req.file?.originalname) {
      req.file.originalname = normalizeUploadOriginalName(req.file.originalname);
    }
    const payload = validateTaskForm(req.body, req.file);
    const task = await createTask({
      schoolName: payload.schoolName,
      queryText: payload.queryText,
      notes: payload.notes,
      file: req.file,
      requestIp: req.ip || null
    });

    await enqueueTask(task.task_id);
    res.status(202).json(task);
  } catch (error) {
    await removeUploadedFile(req.file?.path);
    next(error);
  }
});

app.get('/api/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    const task = await getTask(req.params.taskId);
    if (!task) {
      res.status(404).json({ error: '任务不存在或已过期' });
      return;
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:taskId/cancel', requireAuth, rateLimit, async (req, res, next) => {
  try {
    const task = await getTask(req.params.taskId);
    if (!task) {
      res.status(404).json({ error: '任务不存在或已过期' });
      return;
    }

    if (['completed', 'failed', 'canceled'].includes(task.status)) {
      res.json(task);
      return;
    }

    await requestTaskCancel(req.params.taskId);
    const removed = await cancelQueuedJob(req.params.taskId);
    if (removed) {
      await markTaskCanceled(req.params.taskId, '任务在排队阶段已取消');
    }

    const updatedTask = await getTask(req.params.taskId);
    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  if (req.file?.path) {
    removeUploadedFile(req.file.path).catch(() => {});
  }

  console.error('Unhandled app error:', {
    method: req.method,
    path: req.originalUrl,
    message: err?.message || 'unknown error',
    stack: err?.stack || null
  });

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: `上传文件过大，请控制在 ${Math.round(config.maxUploadSizeBytes / 1024 / 1024)}MB 以内` });
    return;
  }

  res.status(500).json({ error: err?.message || '服务内部错误' });
});

export { app };
