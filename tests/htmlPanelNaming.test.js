const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  extractHtmlPanelTitle,
  ensureHtmlPanelTitle,
  isWeakPanelTitle,
  resolveHtmlPanelPath,
  slugifyPanelTitle,
} = require('../src/main/ipcHandlers');

test('extractHtmlPanelTitle prefers a meaningful heading over a weak date title', () => {
  const html = `
    <!doctype html>
    <html>
    <head><title>20260630-2026-06-30-2</title></head>
    <body><h1>Robotics Market Outlook</h1></body>
    </html>
  `;

  assert.equal(extractHtmlPanelTitle(html), 'Robotics Market Outlook');
});

test('ensureHtmlPanelTitle replaces a weak title with the provided fallback title', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marvis-html-title-'));
  const filePath = path.join(tempDir, 'temp-report.html');

  try {
    fs.writeFileSync(filePath, `
      <!doctype html>
      <html>
      <head><title>20260630-2026-06-30-2</title></head>
      <body><h1>20260630-2026-06-30-2</h1></body>
      </html>
    `);

    const title = ensureHtmlPanelTitle(filePath, 'Quarterly Robotics Market Outlook');
    const saved = fs.readFileSync(filePath, 'utf8');

    assert.equal(title, 'Quarterly Robotics Market Outlook Report');
    assert.match(saved, /<title>Quarterly Robotics Market Outlook Report<\/title>/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('isWeakPanelTitle flags storage-like date titles', () => {
  assert.equal(isWeakPanelTitle('20260630-2026-06-30-2'), true);
  assert.equal(isWeakPanelTitle('Marvis Report'), true);
  assert.equal(isWeakPanelTitle('Asia Robotics Funding Snapshot'), false);
});

test('slugifyPanelTitle preserves meaningful Chinese titles', () => {
  assert.equal(slugifyPanelTitle('美国新闻报告'), '美国新闻报告');
  assert.equal(slugifyPanelTitle('美国新闻 Report'), '美国新闻-report');
});

test('resolveHtmlPanelPath accepts a bare file name from the html-panels folder', () => {
  const resolved = resolveHtmlPanelPath('unit-test-report.html', { mustExist: false });
  const dir = path.dirname(resolved);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolved, '<!doctype html><title>Unit Test Report</title>');

  try {
    assert.equal(resolveHtmlPanelPath('unit-test-report.html'), resolved);
  } finally {
    fs.rmSync(resolved, { force: true });
  }
});
