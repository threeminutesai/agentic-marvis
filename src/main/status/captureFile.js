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

function getNextCapturePath(dataDir) {
  let dir;
  try {
    dir = ensureCaptureDir(dataDir);
  } catch (err) {
    throw new Error(`Failed to ensure capture directory: ${err.message}`);
  }
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
  return path.join(dir, `${stamp}.png`);
}

function pruneCaptures(dataDir, maxCount = 30) {
  const dir = ensureCaptureDir(dataDir);
  const limit = Number(maxCount) > 0 ? Number(maxCount) : 30;
  const files = fs.readdirSync(dir)
    .filter((name) => /\.png$/i.test(name))
    .map((name) => {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      return { name, filePath, timeMs: stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs };
    })
    .sort((a, b) => a.timeMs - b.timeMs);
  const excess = files.length - limit;
  if (excess <= 0) return;
  for (const file of files.slice(0, excess)) {
    try {
      fs.unlinkSync(file.filePath);
    } catch (err) {
      console.log(`[CaptureFile] Failed to prune ${file.name}: ${err.message}`);
    }
  }
}

module.exports = { getCaptureDir, ensureCaptureDir, getNextCapturePath, pruneCaptures };
