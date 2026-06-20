const test = require('node:test');
const assert = require('node:assert');

const { shouldTriggerBriefingVoice } = require('../../src/renderer/voice/briefingSchedule');

test('never frequency never triggers', () => {
  assert.strictEqual(shouldTriggerBriefingVoice('never', null, new Date('2026-06-20T13:40:00')), false);
  assert.strictEqual(shouldTriggerBriefingVoice('never', '2020-01-01T00:00:00', new Date('2026-06-20T13:40:00')), false);
});

test('no prior timestamp always triggers (except never)', () => {
  assert.strictEqual(shouldTriggerBriefingVoice('1h', null, new Date('2026-06-20T13:40:00')), true);
});

test('1h frequency: same hour does not trigger, different hour triggers', () => {
  const last = '2026-06-20T13:10:00';
  assert.strictEqual(shouldTriggerBriefingVoice('1h', last, new Date('2026-06-20T13:40:00')), false);
  assert.strictEqual(shouldTriggerBriefingVoice('1h', last, new Date('2026-06-20T14:01:00')), true);
});

test('6h frequency: same 6-hour bucket does not trigger, different bucket triggers', () => {
  const last = '2026-06-20T13:10:00';
  assert.strictEqual(shouldTriggerBriefingVoice('6h', last, new Date('2026-06-20T17:59:00')), false);
  assert.strictEqual(shouldTriggerBriefingVoice('6h', last, new Date('2026-06-20T18:01:00')), true);
});

test('12h frequency: same 12-hour bucket does not trigger, different bucket triggers', () => {
  const last = '2026-06-20T01:10:00';
  assert.strictEqual(shouldTriggerBriefingVoice('12h', last, new Date('2026-06-20T11:59:00')), false);
  assert.strictEqual(shouldTriggerBriefingVoice('12h', last, new Date('2026-06-20T12:01:00')), true);
});

test('1d frequency: judged by midnight boundary', () => {
  const last = '2026-06-20T23:50:00';
  assert.strictEqual(shouldTriggerBriefingVoice('1d', last, new Date('2026-06-20T23:59:00')), false);
  assert.strictEqual(shouldTriggerBriefingVoice('1d', last, new Date('2026-06-21T00:01:00')), true);
});
