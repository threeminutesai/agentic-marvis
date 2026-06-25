const test = require('node:test');
const assert = require('node:assert/strict');

const {
  audioFileNameForMime,
  cleanTranscriptText,
} = require('../src/main/providers/elevenLabsSttProvider');

test('cleanTranscriptText removes audio event tags but keeps speech', () => {
  assert.equal(cleanTranscriptText('[outro music] financial [phone rings]'), 'financial');
  assert.equal(cleanTranscriptText('[phone]'), '');
});

test('audioFileNameForMime matches common recording containers', () => {
  assert.equal(audioFileNameForMime('audio/webm;codecs=opus'), 'speech.webm');
  assert.equal(audioFileNameForMime('audio/mp4'), 'speech.m4a');
  assert.equal(audioFileNameForMime('audio/wav'), 'speech.wav');
});
