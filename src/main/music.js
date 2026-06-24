const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createEmptyCatalog } = require('../renderer/voice/musicSchedule');

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];

function slugifyOriginalName(originalName) {
  const base = path.parse(originalName).name;
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug || 'track';
}

function createMusicLibraryStore({ filePath, musicDir, fsImpl = fs }) {
  function copyIntoLibrary(sourcePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const slug = slugifyOriginalName(originalName);
    let id; // id IS the filename on disk
    let destPath;
    do {
      id = `trk_${crypto.randomBytes(4).toString('hex')}-${slug}${ext}`;
      destPath = path.join(musicDir, id);
    } while (fsImpl.existsSync(destPath));
    fsImpl.copyFileSync(sourcePath, destPath);
    return { id, originalName, addedAt: new Date().toISOString() };
  }

  function load() {
    if (!fsImpl.existsSync(filePath)) {
      const empty = createEmptyCatalog();
      save(empty);
      return empty;
    }
    try {
      const raw = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
      return {
        tracks: Array.isArray(raw.tracks) ? raw.tracks : [],
        playlists: Array.isArray(raw.playlists) ? raw.playlists : [],
        schedule: raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : createEmptyCatalog().schedule,
      };
    } catch {
      return createEmptyCatalog();
    }
  }

  function save(catalog) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    fsImpl.writeFileSync(filePath, JSON.stringify(catalog, null, 2));
  }

  function importFiles(filePaths) {
    fsImpl.mkdirSync(musicDir, { recursive: true });
    const catalog = load();
    for (const sourcePath of filePaths) {
      try {
        const ext = path.extname(sourcePath).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
        const originalName = path.basename(sourcePath);
        catalog.tracks.push(copyIntoLibrary(sourcePath, originalName));
      } catch {
        // Skip files that can't be copied (missing, unreadable, etc.) and continue importing the rest.
      }
    }
    save(catalog);
    return catalog;
  }

  function deleteTrack(trackId) {
    const catalog = load();
    const onDiskPath = path.join(musicDir, trackId); // id IS the filename
    if (fsImpl.existsSync(onDiskPath)) fsImpl.unlinkSync(onDiskPath);
    catalog.tracks = catalog.tracks.filter((t) => t.id !== trackId);
    catalog.playlists = catalog.playlists.map((p) => ({
      ...p,
      trackIds: p.trackIds.filter((id) => id !== trackId),
    }));
    save(catalog);
    return catalog;
  }

  return { load, save, importFiles, deleteTrack };
}

module.exports = { createMusicLibraryStore, SUPPORTED_EXTENSIONS };
