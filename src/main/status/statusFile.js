// src/main/status/statusFile.js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TEMPLATE_TYPES = [
  'Weather',
  'Unread Emails',
  'Urgent Emails',
  'News Briefing',
  'Avatar Briefing',
  'Email Content',
];

// Regenerates the template when the file is missing OR found empty (empty
// file, empty/non-array JSON) - a fresh exe placed in a new folder, or a
// status file emptied out by hand, both end up with a usable default.
function isEmptyStatusFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return true;
  }
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

function ensureStatusFile(filePath) {
  if (fs.existsSync(filePath) && !isEmptyStatusFile(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function hashStatusRows(rows) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(rows || []))
    .digest('hex');
}

module.exports = { ensureStatusFile, readStatusRows, hashStatusRows };
