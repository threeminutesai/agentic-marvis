const fs = require('node:fs');
const path = require('node:path');

function getCaptureDir(dataDir) {
  return path.join(dataDir, 'captures');
}

function ensureCaptureDir(dataDir) {
  const dir = getCaptureDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listCaptureIds(dir) {
  return fs.readdirSync(dir)
    .map((name) => /^(\d{5})\.png$/i.exec(name)?.[1])
    .filter(Boolean)
    .map((id) => Number(id))
    .sort((a, b) => a - b);
}

function getNextCapturePath(dataDir) {
  let dir;
  try {
    dir = ensureCaptureDir(dataDir);
  } catch (err) {
    throw new Error(`Failed to ensure capture directory: ${err.message}`);
  }
  const existingIds = listCaptureIds(dir);
  const nextId = String((existingIds.length ? Math.max(...existingIds) : 0) + 1).padStart(5, '0');
  return path.join(dir, `${nextId}.png`);
}

function pruneCaptures(dataDir, maxCount = 30) {
  const dir = ensureCaptureDir(dataDir);
  const limit = Number(maxCount) > 0 ? Number(maxCount) : 30;
  const ids = listCaptureIds(dir);
  const excess = ids.length - limit;
  if (excess <= 0) return;
  for (const id of ids.slice(0, excess)) {
    const fileName = `${String(id).padStart(5, '0')}.png`;
    try {
      fs.unlinkSync(path.join(dir, fileName));
    } catch (err) {
      console.log(`[CaptureFile] Failed to prune ${fileName}: ${err.message}`);
    }
  }
}

module.exports = { getCaptureDir, ensureCaptureDir, getNextCapturePath, pruneCaptures };
