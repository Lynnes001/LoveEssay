import { config } from '../config.js';

const ipBuckets = new Map();

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

export function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const nowMinute = Math.floor(Date.now() / 60000);
  const bucket = ipBuckets.get(ip);

  if (!bucket || bucket.minute !== nowMinute) {
    ipBuckets.set(ip, { minute: nowMinute, count: 1 });
    next();
    return;
  }

  if (bucket.count >= config.rateLimitPerMinute) {
    res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    return;
  }

  bucket.count += 1;
  next();
}
