import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExtractionPrompt } from '../../src/workflow/prompts.js';

test('buildExtractionPrompt only uses material and school context', () => {
  const prompt = buildExtractionPrompt({
    schoolName: 'Stanford University',
    queryText: 'Please emphasize leadership and confidence.',
    notes: 'Parent says avoid mentioning family details.',
    chunk: {
      section_type: 'resume',
      content: 'Student built a low-cost air-quality sensor with Arduino and Python.'
    }
  });

  assert.match(prompt, /目标学校：Stanford University/);
  assert.match(prompt, /当前片段类型提示：resume/);
  assert.match(prompt, /Student built a low-cost air-quality sensor/);
  assert.doesNotMatch(prompt, /Please emphasize leadership and confidence\./);
  assert.doesNotMatch(prompt, /Parent says avoid mentioning family details\./);
});
