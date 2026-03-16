import crypto from 'node:crypto';
import { config } from '../config.js';

const AUTH_COOKIE_NAME = 'loveessay_session';

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

function base64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function buildSignature(payload) {
  return crypto.createHmac('sha256', config.auth.sessionSecret).update(payload).digest('base64url');
}

function buildCookieValue(username) {
  const payload = JSON.stringify({
    sub: username,
    exp: Date.now() + config.auth.sessionTtlMs
  });
  const encodedPayload = base64urlEncode(payload);
  const signature = buildSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function readSession(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split('.', 2);
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = buildSignature(encodedPayload);
  if (signature.length !== expectedSignature.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (!payload?.sub || !payload?.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function buildCookieAttributes(maxAgeSeconds) {
  const attributes = [
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (config.auth.secureCookie) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

export function setAuthCookie(res, username) {
  const value = buildCookieValue(username);
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; ${buildCookieAttributes(config.auth.sessionTtlMs / 1000)}`);
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; ${buildCookieAttributes(0)}`);
}

export function readAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  return readSession(cookies[AUTH_COOKIE_NAME]);
}

export function requireAuth(req, res, next) {
  const session = readAuthenticatedUser(req);
  if (!session) {
    const wantsJson =
      req.path.startsWith('/api/') ||
      String(req.headers.accept || '').includes('application/json') ||
      req.xhr;

    if (wantsJson) {
      res.status(401).json({
        error: '请先登录',
        redirect: `/login?next=${encodeURIComponent(req.originalUrl || '/')}`
      });
      return;
    }

    res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/')}`);
    return;
  }

  req.auth = session;
  next();
}

export function handleLogin(username, password) {
  return username === config.auth.username && password === config.auth.password;
}
