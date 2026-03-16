import { config } from '../config.js';
import { createTraceable } from '../services/tracing.js';
import { safeJsonParse } from './utils.js';

function normalizeContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item?.type === 'text') {
          return item.text || '';
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

async function rawDashScopeChat({
  model,
  systemPrompt,
  userPrompt,
  temperature = 0.3,
  topP = 0.8
}) {
  if (!config.dashScopeApiKey) {
    throw new Error('服务端未配置 DASHSCOPE_API_KEY');
  }

  const response = await fetch(`${config.dashScopeBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.dashScopeApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      top_p: topP,
      stream: false,
      enable_thinking: false,
      extra_body: {
        enable_thinking: false
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(raw?.error?.message || raw?.message || `模型请求失败 (${response.status})`);
  }

  const message = raw?.choices?.[0]?.message;
  const text = normalizeContent(message?.content);
  if (!text) {
    throw new Error('模型返回为空');
  }

  return {
    text,
    usage: raw?.usage || null,
    requestId: raw?.id || null
  };
}

export const callDashScopeChat = createTraceable(rawDashScopeChat, {
  name: 'DashScope Chat Completion',
  run_type: 'llm',
  metadata: {
    ls_provider: 'dashscope-compatible'
  }
});

function buildJsonRepairPrompt(rawText) {
  return `
请把下面这段“接近 JSON 但不合法”的内容修复成严格合法 JSON。

要求：
1. 只输出 JSON，不要解释。
2. 保留原意，不要新增事实。
3. 修复缺失逗号、尾逗号、引号、括号闭合等格式问题。

原始内容：
${rawText}
`.trim();
}

async function repairJsonResponse({ model, text }) {
  const repaired = await callDashScopeChat({
    model,
    systemPrompt: 'You repair malformed JSON. Return valid JSON only.',
    userPrompt: buildJsonRepairPrompt(text),
    temperature: 0
  });

  return repaired.text;
}

export async function callDashScopeJson(args) {
  const response = await callDashScopeChat(args);
  try {
    return {
      ...response,
      json: safeJsonParse(response.text)
    };
  } catch (error) {
    const repairedText = await repairJsonResponse({
      model: args.model,
      text: response.text
    }).catch(() => null);

    if (repairedText) {
      try {
        return {
          ...response,
          repairedText,
          json: safeJsonParse(repairedText)
        };
      } catch (repairError) {
        repairError.rawText = response.text;
        repairError.repairedText = repairedText;
        throw repairError;
      }
    }

    error.rawText = response.text;
    throw error;
  }
}
