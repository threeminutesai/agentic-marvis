// src/main/status/statusFile.js
const fs = require('node:fs');

const TEMPLATE_TYPES = [
  'Weather',
  'Unread Emails',
  'Urgent Emails',
  'News Briefing',
  'Email Content',
];

function ensureStatusFile(filePath) {
  if (fs.existsSync(filePath)) return;
  const rows = TEMPLATE_TYPES.map((type) => ({ type, value: '', detail: '' }));
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

function readStatusRows(filePath) {
  ensureStatusFile(filePath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return TEMPLATE_TYPES.map((type) => ({ type, value: '', detail: '' }));
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => ({
      type: String(row?.type ?? '').trim(),
      value: String(row?.value ?? '').trim(),
      detail: String(row?.detail ?? '').trim(),
    }))
    .filter((row) => row.type);
}

module.exports = { ensureStatusFile, readStatusRows };
