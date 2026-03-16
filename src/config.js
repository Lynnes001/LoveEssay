import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  rootDir: ROOT_DIR,
  port: parseNumber(process.env.PORT, 6789),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${parseNumber(process.env.PORT, 6789)}`,
  auth: {
    username: process.env.APP_LOGIN_USER || process.env.BASIC_AUTH_USER || 'admin',
    password: process.env.APP_LOGIN_PASS || process.env.BASIC_AUTH_PASS || 'change-me',
    sessionSecret: process.env.AUTH_SESSION_SECRET || process.env.APP_LOGIN_PASS || process.env.BASIC_AUTH_PASS || 'change-me',
    sessionTtlMs: parseNumber(process.env.AUTH_SESSION_TTL_SECONDS, 7 * 24 * 60 * 60) * 1000,
    secureCookie: process.env.AUTH_SECURE_COOKIE === 'true'
  },
  dashScopeApiKey: process.env.DASHSCOPE_API_KEY || '',
  dashScopeBaseUrl: (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
  models: {
    extract: process.env.EXTRACT_MODEL || 'qwen3.5-plus',
    draft: process.env.DRAFT_MODEL || 'qwen3.5-plus',
    rewrite: process.env.REWRITE_MODEL || 'qwen3-14b-81bba393c391',
    check: process.env.CHECK_MODEL || 'qwen3.5-plus'
  },
  databaseUrl: process.env.DATABASE_URL || 'postgresql://loveessay:loveessay@127.0.0.1:5432/loveessay',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  queueName: process.env.QUEUE_NAME || 'loveessay-tasks',
  uploadDir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR || './uploads'),
  maxUploadSizeBytes: parseNumber(process.env.MAX_UPLOAD_SIZE_MB, 15) * 1024 * 1024,
  rateLimitPerMinute: parseNumber(process.env.RATE_LIMIT_PER_MINUTE, 30),
  taskTimeoutMs: parseNumber(process.env.TASK_TIMEOUT_MS, 15 * 60 * 1000),
  taskTtlMs: parseNumber(process.env.TASK_TTL_MS, 48 * 60 * 60 * 1000),
  workflowVersion: 'langgraph-docx-v1'
};
