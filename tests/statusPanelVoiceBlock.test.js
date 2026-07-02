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

test('extractVoiceContentBlock falls back when html path is present but voice tag is missing', () => {
  const block = extractVoiceContentBlock(`
[html]
C:\\reports\\robotics.html

The report is ready and covers the top robotics funding moves today.
  `);

  assert.equal(block.titleText, '');
  assert.equal(block.voiceText, 'The report is ready and covers the top robotics funding moves today.');
  assert.equal(block.htmlPath, 'C:\\reports\\robotics.html');
});

test('extractVoiceContentBlock detects an embedded html filename in normal reply text', () => {
  const block = extractVoiceContentBlock('报告已生成，保存至 `20260701-马来西亚大选情况生成简报-report.html`。报告涵盖：席位分布、联合政府组阁过程、阵营对比与前瞻分析。');

  assert.equal(block.titleText, '');
  assert.equal(block.htmlPath, '20260701-马来西亚大选情况生成简报-report.html');
  assert.match(block.voiceText, /报告已生成/);
  assert.doesNotMatch(block.voiceText, /\.html/i);
});
