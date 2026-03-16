import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { ValidationError } from './errors.js';

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, config.uploadDir);
  },
  filename(req, file, callback) {
    const normalizedOriginalName = normalizeUploadOriginalName(file.originalname);
    const safeBase = path
      .basename(normalizedOriginalName, path.extname(normalizedOriginalName))
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 80);
    callback(null, `${Date.now()}-${safeBase || 'material'}${path.extname(normalizedOriginalName).toLowerCase()}`);
  }
});

function looksLikeMojibake(text) {
  return /[ÃÂÐÑØæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(text) || /ï¼|å®|è|ä¿|é/.test(text);
}

function countCjkChars(text) {
  const matches = String(text || '').match(/[\u3400-\u9fff\uf900-\ufaff]/g);
  return matches ? matches.length : 0;
}

function countReplacementChars(text) {
  return (String(text || '').match(/\uFFFD/g) || []).length;
}

export function normalizeUploadOriginalName(originalName) {
  const source = String(originalName || '').trim();
  if (!source) {
    return 'material.docx';
  }

  const decoded = Buffer.from(source, 'latin1').toString('utf8').trim();
  if (!decoded) {
    return source;
  }

  const sourceCjkCount = countCjkChars(source);
  const decodedCjkCount = countCjkChars(decoded);
  const decodedReplacementCount = countReplacementChars(decoded);

  if (decodedCjkCount > sourceCjkCount) {
    return decoded;
  }

  if (looksLikeMojibake(source) && decodedCjkCount > 0 && decodedReplacementCount <= 2) {
    return decoded;
  }

  return source;
}

function fileFilter(req, file, callback) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.docx') {
    callback(new ValidationError('当前版本仅支持上传 .docx Word 文件'));
    return;
  }

  callback(null, true);
}

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: config.maxUploadSizeBytes },
  fileFilter
});

export async function removeUploadedFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('Failed to remove uploaded file:', filePath, error);
    }
  }
}
