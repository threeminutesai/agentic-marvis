// src/main/status/statusFile.js
const fs = require('node:fs');

const TEMPLATE_TYPES = [
  'Weather',
  'Unread Emails',
  'Urgent Emails',
  'News Briefing',
  'Avatar Briefing',
  'Email Content',
];

function ensureStatusFile(filePath) {
  if (fs.existsSync(filePath)) return;
  const rows = TEMPLATE_TYPES.map((type) => ({ type, value: '', detail: '' }));
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

function normalizeField(field) {
  if (Array.isArray(field)) return field.map((item) => String(item ?? '').trim());
  return String(field ?? '').trim();
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
      value: normalizeField(row?.value),
      detail: normalizeField(row?.detail),
      image: normalizeField(row?.image),
      link: normalizeField(row?.link),
    }))
    .filter((row) => row.type);
}

module.exports = { ensureStatusFile, readStatusRows };
