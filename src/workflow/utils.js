export function stripCodeFence(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractBalancedJson(text) {
  const value = String(text || '').trim();
  if (!value) {
    return null;
  }

  const start = value.search(/[\[{]/);
  if (start < 0) {
    return null;
  }

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack.at(-1) !== expected) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function safeJsonParse(text) {
  const trimmed = stripCodeFence(text);
  if (!trimmed) {
    throw new Error('模型未返回 JSON 内容');
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const candidate = extractBalancedJson(trimmed);
    if (candidate) {
      return JSON.parse(candidate);
    }
    throw error;
  }
}

export function dedupeStrings(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function dedupeObjects(items = [], keyBuilder) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item) {
      continue;
    }
    const key = keyBuilder(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function truncate(text, maxLength = 1200) {
  const value = String(text || '').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
