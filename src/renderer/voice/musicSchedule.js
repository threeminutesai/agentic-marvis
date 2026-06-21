const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const BUCKET_KEYS = ['earlyMorning', 'morning', 'afternoon', 'evening', 'midnight'];
const BUCKETS = [
  { key: 'earlyMorning', startHour: 5, endHour: 8 },
  { key: 'morning', startHour: 8, endHour: 12 },
  { key: 'afternoon', startHour: 12, endHour: 17 },
  { key: 'evening', startHour: 17, endHour: 21 },
  { key: 'midnight', startHour: 21, endHour: 5 }, // wraps past midnight
];

function getBucketForHour(hour) {
  for (const bucket of BUCKETS) {
    if (bucket.startHour < bucket.endHour) {
      if (hour >= bucket.startHour && hour < bucket.endHour) return bucket.key;
    } else if (hour >= bucket.startHour || hour < bucket.endHour) {
      return bucket.key;
    }
  }
  return BUCKETS[BUCKETS.length - 1].key;
}

// The midnight bucket (21:00-5:00) spans two calendar days. Hours before
// 5am belong to the PREVIOUS day's midnight slot (e.g. 2am Tuesday is still
// "Monday night"), matching how a user thinks about assigning night music.
function getActiveSlot(date = new Date()) {
  const hour = date.getHours();
  const bucket = getBucketForHour(hour);
  const ownerDate = bucket === 'midnight' && hour < 5
    ? new Date(date.getTime() - 24 * 60 * 60 * 1000)
    : date;
  return { day: DAY_NAMES[ownerDate.getDay()], bucket };
}

function createEmptySchedule() {
  const schedule = {};
  for (const day of DAY_NAMES) {
    schedule[day] = {};
    for (const bucketKey of BUCKET_KEYS) schedule[day][bucketKey] = null;
  }
  return schedule;
}

function createEmptyCatalog() {
  return { tracks: [], playlists: [], schedule: createEmptySchedule() };
}

function getPlaylistForSlot(catalog, day, bucketKey) {
  const playlistId = catalog.schedule?.[day]?.[bucketKey];
  if (!playlistId) return null;
  return catalog.playlists.find((p) => p.id === playlistId) || null;
}

function removePlaylistFromCatalog(catalog, playlistId) {
  const playlists = catalog.playlists.filter((p) => p.id !== playlistId);
  const schedule = {};
  for (const day of Object.keys(catalog.schedule)) {
    schedule[day] = {};
    for (const bucketKey of Object.keys(catalog.schedule[day])) {
      const value = catalog.schedule[day][bucketKey];
      schedule[day][bucketKey] = value === playlistId ? null : value;
    }
  }
  return { ...catalog, playlists, schedule };
}

// Fisher-Yates. `rng` is injectable so tests can pin the order; defaults to
// Math.random for real playback use.
function shuffleTracks(tracks, rng = Math.random) {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = {
    DAY_NAMES,
    BUCKET_KEYS,
    getBucketForHour,
    getActiveSlot,
    createEmptySchedule,
    createEmptyCatalog,
    getPlaylistForSlot,
    removePlaylistFromCatalog,
    shuffleTracks,
  };
}
