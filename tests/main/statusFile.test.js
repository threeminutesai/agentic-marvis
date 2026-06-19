const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureStatusFile, readStatusRows } = require('../../src/main/status/statusFile');

function tempFilePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-status-'));
  return path.join(dir, 'status.json');
}

test('ensureStatusFile creates a template JSON file with empty value/detail fields', () => {
  const filePath = tempFilePath();
  ensureStatusFile(filePath);
  assert.strictEqual(fs.existsSync(filePath), true);

  const rows = readStatusRows(filePath);
  assert.deepStrictEqual(rows.map((r) => r.type), ['Weather', 'Unread Emails', 'Urgent Emails', 'News Briefing', 'Email Content']);
  for (const row of rows) {
    assert.strictEqual(row.value, '');
    assert.strictEqual(row.detail, '');
  }
});

test('ensureStatusFile does not overwrite an existing file', () => {
  const filePath = tempFilePath();
  ensureStatusFile(filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data[0].value = '22C and sunny';
  data[0].detail = 'Clear skies all day with a light breeze.';
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  ensureStatusFile(filePath);
  const rows = readStatusRows(filePath);
  assert.strictEqual(rows[0].value, '22C and sunny');
  assert.strictEqual(rows[0].detail, 'Clear skies all day with a light breeze.');
});

test('readStatusRows trims whitespace and skips rows with no type', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, JSON.stringify([
    { type: ' Weather ', value: ' 22C ', detail: ' Clear. ' },
    { type: '', value: 'orphan value', detail: '' },
  ]));

  const rows = readStatusRows(filePath);
  assert.deepStrictEqual(rows, [{ type: 'Weather', value: '22C', detail: 'Clear.' }]);
});

test('readStatusRows falls back to default template rows on corrupt JSON', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, 'not valid json {{{');

  const rows = readStatusRows(filePath);
  assert.deepStrictEqual(rows.map((r) => r.type), ['Weather', 'Unread Emails', 'Urgent Emails', 'News Briefing', 'Email Content']);
  for (const row of rows) {
    assert.strictEqual(row.value, '');
    assert.strictEqual(row.detail, '');
  }
});
