const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMusicLibraryStore, SUPPORTED_EXTENSIONS } = require('../../src/main/music');

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-music-'));
  return {
    filePath: path.join(root, 'jarvis-music-library.json'),
    musicDir: path.join(root, 'music'),
    root,
  };
}

test('createMusicLibraryStore returns an empty catalog when no file exists', () => {
  const { filePath, musicDir } = makeDirs();
  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.load();
  assert.deepStrictEqual(catalog.tracks, []);
  assert.deepStrictEqual(catalog.playlists, []);
  assert.strictEqual(Object.keys(catalog.schedule).length, 7);
});

test('createMusicLibraryStore returns an empty catalog when the file is corrupt', () => {
  const { filePath, musicDir } = makeDirs();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{ not valid json');
  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.load();
  assert.deepStrictEqual(catalog.tracks, []);
});

test('save then load round-trips the catalog', () => {
  const { filePath, musicDir } = makeDirs();
  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.load();
  catalog.playlists.push({ id: 'pl_focus', name: 'Focus', trackIds: [] });
  catalog.schedule.monday.morning = 'pl_focus';
  store.save(catalog);

  const reloaded = createMusicLibraryStore({ filePath, musicDir }).load();
  assert.strictEqual(reloaded.playlists[0].name, 'Focus');
  assert.strictEqual(reloaded.schedule.monday.morning, 'pl_focus');
});

test('importFiles copies a supported file into musicDir and appends a track entry', () => {
  const { filePath, musicDir, root } = makeDirs();
  const sourcePath = path.join(root, 'Sunrise.mp3');
  fs.writeFileSync(sourcePath, 'fake mp3 bytes');

  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.importFiles([sourcePath]);

  assert.strictEqual(catalog.tracks.length, 1);
  assert.strictEqual(catalog.tracks[0].originalName, 'Sunrise.mp3');
  assert.ok(catalog.tracks[0].id.startsWith('trk_'));
  assert.ok(fs.existsSync(path.join(musicDir, catalog.tracks[0].fileName)));
});

test('importFiles skips files with an unsupported extension', () => {
  const { filePath, musicDir, root } = makeDirs();
  const sourcePath = path.join(root, 'notes.txt');
  fs.writeFileSync(sourcePath, 'not audio');

  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.importFiles([sourcePath]);

  assert.strictEqual(catalog.tracks.length, 0);
});

test('importFiles persists the catalog so a fresh store sees the imported track', () => {
  const { filePath, musicDir, root } = makeDirs();
  const sourcePath = path.join(root, 'Focus.wav');
  fs.writeFileSync(sourcePath, 'fake wav bytes');

  createMusicLibraryStore({ filePath, musicDir }).importFiles([sourcePath]);
  const reloaded = createMusicLibraryStore({ filePath, musicDir }).load();
  assert.strictEqual(reloaded.tracks.length, 1);
});

test('deleteTrack removes the file from disk, the catalog entry, and every playlist reference', () => {
  const { filePath, musicDir, root } = makeDirs();
  const sourcePath = path.join(root, 'Old.mp3');
  fs.writeFileSync(sourcePath, 'fake bytes');

  const store = createMusicLibraryStore({ filePath, musicDir });
  let catalog = store.importFiles([sourcePath]);
  const trackId = catalog.tracks[0].id;
  const onDiskPath = path.join(musicDir, catalog.tracks[0].fileName);

  catalog.playlists.push({ id: 'pl_focus', name: 'Focus', trackIds: [trackId] });
  store.save(catalog);

  catalog = store.deleteTrack(trackId);
  assert.strictEqual(catalog.tracks.length, 0);
  assert.deepStrictEqual(catalog.playlists[0].trackIds, []);
  assert.strictEqual(fs.existsSync(onDiskPath), false);
});

test('deleteTrack is a no-op (not a throw) when the track id does not exist', () => {
  const { filePath, musicDir } = makeDirs();
  const store = createMusicLibraryStore({ filePath, musicDir });
  const catalog = store.deleteTrack('trk_does_not_exist');
  assert.deepStrictEqual(catalog.tracks, []);
});

test('SUPPORTED_EXTENSIONS covers the common audio formats', () => {
  assert.deepStrictEqual(
    [...SUPPORTED_EXTENSIONS].sort(),
    ['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav'].sort()
  );
});
