const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getCaptureDir, ensureCaptureDir, getNextCapturePath, pruneCaptures } = require('../../src/main/status/captureFile');

function tempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-captures-'));
}

test('getCaptureDir returns a captures subfolder under the given data dir', () => {
  const dataDir = tempDataDir();
  assert.strictEqual(getCaptureDir(dataDir), path.join(dataDir, 'captures'));
});

test('ensureCaptureDir creates the captures folder if missing', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  assert.strictEqual(fs.existsSync(dir), true);
});

test('getNextCapturePath returns 00001.png in an empty captures folder', () => {
  const dataDir = tempDataDir();
  const filePath = getNextCapturePath(dataDir);
  assert.strictEqual(path.basename(filePath), '00001.png');
});

test('getNextCapturePath increments past existing numbered files', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  fs.writeFileSync(path.join(dir, '00001.png'), '');
  fs.writeFileSync(path.join(dir, '00002.png'), '');
  const filePath = getNextCapturePath(dataDir);
  assert.strictEqual(path.basename(filePath), '00003.png');
});

test('getNextCapturePath ignores non-matching file names', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  fs.writeFileSync(path.join(dir, 'notes.txt'), '');
  fs.writeFileSync(path.join(dir, '00005.png'), '');
  const filePath = getNextCapturePath(dataDir);
  assert.strictEqual(path.basename(filePath), '00006.png');
});

test('pruneCaptures deletes the oldest files beyond the cap', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.png`), '');
  }
  pruneCaptures(dataDir, 3);
  const remaining = fs.readdirSync(dir).sort();
  assert.deepStrictEqual(remaining, ['00003.png', '00004.png', '00005.png']);
});

test('pruneCaptures does nothing when under the cap', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  fs.writeFileSync(path.join(dir, '00001.png'), '');
  pruneCaptures(dataDir, 30);
  assert.deepStrictEqual(fs.readdirSync(dir), ['00001.png']);
});

test('pruneCaptures defaults maxCount to 30 when given 0 or negative value', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  for (let i = 1; i <= 35; i++) {
    fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.png`), '');
  }
  pruneCaptures(dataDir, 0);
  const remaining = fs.readdirSync(dir);
  assert.strictEqual(remaining.length, 30);
  assert.deepStrictEqual(remaining[0], '00006.png');
  assert.deepStrictEqual(remaining[29], '00035.png');
});

test('getNextCapturePath with 5-digit ID overflow produces 100000.png', () => {
  const dataDir = tempDataDir();
  const dir = ensureCaptureDir(dataDir);
  for (let i = 1; i <= 99999; i++) {
    fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.png`), '');
  }
  const filePath = getNextCapturePath(dataDir);
  assert.strictEqual(path.basename(filePath), '100000.png');
});
