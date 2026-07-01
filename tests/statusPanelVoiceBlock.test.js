const test = require('node:test');
const assert = require('node:assert/strict');

const { extractVoiceContentBlock } = require('../src/renderer/statusPanel');

test('extractVoiceContentBlock reads explicit title, voice, and html tags', () => {
  const block = extractVoiceContentBlock(`
[title]
Asia Robotics Funding Snapshot
[voice]
I prepared the report, sir.
[html]
C:\\reports\\robotics.html
  `);

  assert.equal(block.titleText, 'Asia Robotics Funding Snapshot');
  assert.equal(block.voiceText, 'I prepared the report, sir.');
  assert.equal(block.htmlPath, 'C:\\reports\\robotics.html');
});
