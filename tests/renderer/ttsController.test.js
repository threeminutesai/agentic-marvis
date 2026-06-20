const test = require('node:test');
const assert = require('node:assert');

const { isElevenLabsQuotaShortage } = require('../../src/renderer/voice/ttsController');

test('isElevenLabsQuotaShortage detects ElevenLabs quota and credit shortage errors', () => {
  assert.strictEqual(
    isElevenLabsQuotaShortage('ElevenLabs API error (401) - This request exceeds your quota of 10000. You have 31 credits remaining, while 62 credits are required for this request.'),
    true
  );
  assert.strictEqual(
    isElevenLabsQuotaShortage('You have 31 credits remaining, while 62 credits are required for this request.'),
    true
  );
});

test('isElevenLabsQuotaShortage ignores unrelated ElevenLabs errors', () => {
  assert.strictEqual(isElevenLabsQuotaShortage('ElevenLabs API error (401) - Invalid API key'), false);
  assert.strictEqual(isElevenLabsQuotaShortage('Network request failed'), false);
  assert.strictEqual(isElevenLabsQuotaShortage(''), false);
});
