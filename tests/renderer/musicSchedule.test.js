const test = require('node:test');
const assert = require('node:assert');

const {
  getBucketForHour,
  getActiveSlot,
  createEmptyCatalog,
  getPlaylistForSlot,
  removePlaylistFromCatalog,
  shuffleTracks,
} = require('../../src/renderer/voice/musicSchedule');

test('getBucketForHour resolves every boundary correctly', () => {
  assert.strictEqual(getBucketForHour(5), 'earlyMorning');
  assert.strictEqual(getBucketForHour(7), 'earlyMorning');
  assert.strictEqual(getBucketForHour(8), 'morning');
  assert.strictEqual(getBucketForHour(11), 'morning');
  assert.strictEqual(getBucketForHour(12), 'afternoon');
  assert.strictEqual(getBucketForHour(16), 'afternoon');
  assert.strictEqual(getBucketForHour(17), 'evening');
  assert.strictEqual(getBucketForHour(20), 'evening');
  assert.strictEqual(getBucketForHour(21), 'midnight');
  assert.strictEqual(getBucketForHour(23), 'midnight');
  assert.strictEqual(getBucketForHour(0), 'midnight');
  assert.strictEqual(getBucketForHour(4), 'midnight');
});

test('getActiveSlot: hours 5-20 belong to today', () => {
  const date = new Date(2026, 5, 22, 9, 30); // some Monday, 9:30am
  const slot = getActiveSlot(date);
  assert.strictEqual(slot.bucket, 'morning');
  const expectedDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  assert.strictEqual(slot.day, expectedDayNames[date.getDay()]);
});

test('getActiveSlot: 9pm-11:59pm midnight bucket belongs to today', () => {
  const date = new Date(2026, 5, 22, 22, 15);
  const slot = getActiveSlot(date);
  assert.strictEqual(slot.bucket, 'midnight');
  const expectedDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  assert.strictEqual(slot.day, expectedDayNames[date.getDay()]);
});

test('getActiveSlot: midnight-4:59am midnight bucket belongs to the PREVIOUS calendar day', () => {
  const date = new Date(2026, 5, 22, 2, 0); // 2am
  const previousDay = new Date(2026, 5, 21, 2, 0);
  const slot = getActiveSlot(date);
  assert.strictEqual(slot.bucket, 'midnight');
  const expectedDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  assert.strictEqual(slot.day, expectedDayNames[previousDay.getDay()]);
});

test('createEmptyCatalog has all 7 days x 5 buckets set to null', () => {
  const catalog = createEmptyCatalog();
  assert.deepStrictEqual(catalog.tracks, []);
  assert.deepStrictEqual(catalog.playlists, []);
  const days = Object.keys(catalog.schedule);
  assert.strictEqual(days.length, 7);
  for (const day of days) {
    assert.deepStrictEqual(catalog.schedule[day], {
      earlyMorning: null,
      morning: null,
      afternoon: null,
      evening: null,
      midnight: null,
    });
  }
});

test('getPlaylistForSlot returns the assigned playlist object', () => {
  const catalog = createEmptyCatalog();
  catalog.playlists.push({ id: 'pl_focus', name: 'Focus', trackIds: [] });
  catalog.schedule.monday.morning = 'pl_focus';
  const playlist = getPlaylistForSlot(catalog, 'monday', 'morning');
  assert.strictEqual(playlist.id, 'pl_focus');
});

test('getPlaylistForSlot returns null for an empty slot', () => {
  const catalog = createEmptyCatalog();
  assert.strictEqual(getPlaylistForSlot(catalog, 'monday', 'morning'), null);
});

test('getPlaylistForSlot returns null when the assigned playlist id no longer exists', () => {
  const catalog = createEmptyCatalog();
  catalog.schedule.monday.morning = 'pl_missing';
  assert.strictEqual(getPlaylistForSlot(catalog, 'monday', 'morning'), null);
});

test('removePlaylistFromCatalog removes the playlist and clears every schedule reference to it', () => {
  const catalog = createEmptyCatalog();
  catalog.playlists.push({ id: 'pl_focus', name: 'Focus', trackIds: [] });
  catalog.playlists.push({ id: 'pl_chill', name: 'Chill', trackIds: [] });
  catalog.schedule.monday.morning = 'pl_focus';
  catalog.schedule.tuesday.evening = 'pl_focus';
  catalog.schedule.friday.evening = 'pl_chill';

  const updated = removePlaylistFromCatalog(catalog, 'pl_focus');
  assert.strictEqual(updated.playlists.length, 1);
  assert.strictEqual(updated.playlists[0].id, 'pl_chill');
  assert.strictEqual(updated.schedule.monday.morning, null);
  assert.strictEqual(updated.schedule.tuesday.evening, null);
  assert.strictEqual(updated.schedule.friday.evening, 'pl_chill');
});

test('shuffleTracks returns all the same items in a (possibly) different order, original array untouched', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const shuffled = shuffleTracks(tracks, () => 0); // rng pinned to 0 => deterministic
  assert.strictEqual(shuffled.length, 4);
  assert.deepStrictEqual(tracks.map((t) => t.id), ['a', 'b', 'c', 'd'], 'original array must not be mutated');
  const ids = shuffled.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, ['a', 'b', 'c', 'd']);
});
