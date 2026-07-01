const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  extractHtmlPanelTitle,
  ensureHtmlPanelTitle,
  isWeakPanelTitle,
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
