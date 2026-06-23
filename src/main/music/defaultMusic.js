// Default royalty-free music schedule and catalog for fresh installs
// These tracks are automatically imported into data/music on first run

const DEFAULT_MUSIC_TRACKS = [
  {
    id: 'early-morning',
    fileName: 'johan_benitez99co-day-516015.mp3',
    title: 'Day',
    artist: 'Johan Benitez',
    duration: 0,
  },
  {
    id: 'morning',
    fileName: 'fatbunny-working-488068.mp3',
    title: 'Working',
    artist: 'FatBunny',
    duration: 0,
  },
  {
    id: 'afternoon',
    fileName: 'u_98o9hlkn7r-corporate-financial-success-272259.mp3',
    title: 'Corporate Financial Success',
    artist: 'Corporate Music',
    duration: 0,
  },
  {
    id: 'evening',
    fileName: 'jourinhannah-romance-234850.mp3',
    title: 'Romance',
    artist: 'Jorin Hannah',
    duration: 0,
  },
  {
    id: 'mid-night',
    fileName: 'the_mountain-cosmic-study-143288.mp3',
    title: 'Cosmic Study',
    artist: 'The Mountain',
    duration: 0,
  },
  {
    id: 'weekend-chill',
    fileName: 'fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3',
    title: 'Calm Mind Chill Lofi',
    artist: 'Fassounds',
    duration: 0,
  },
  {
    id: 'weekend-work',
    fileName: 'openmindaudio-working-class-country-anthem-worn-hands-538391.mp3',
    title: 'Working Class Country Anthem',
    artist: 'Open Mind Audio',
    duration: 0,
  },
];

// Default schedule, keyed by full day name x camelCase bucket (matches
// src/renderer/voice/musicSchedule.js DAY_NAMES/BUCKET_KEYS). Values here are
// playlist ids (pl_<trackId>), since ensureDataFilesExist always creates one
// playlist per track.
const WEEKDAY_BUCKETS = {
  earlyMorning: 'pl_early-morning',
  morning: 'pl_morning',
  afternoon: 'pl_afternoon',
  evening: 'pl_evening',
  midnight: 'pl_mid-night',
};
const WEEKEND_BUCKETS = {
  earlyMorning: 'pl_weekend',
  morning: 'pl_weekend',
  afternoon: 'pl_weekend',
  evening: 'pl_weekend',
  midnight: 'pl_weekend',
};
const DEFAULT_MUSIC_SCHEDULE = {
  monday: { ...WEEKDAY_BUCKETS },
  tuesday: { ...WEEKDAY_BUCKETS },
  wednesday: { ...WEEKDAY_BUCKETS },
  thursday: { ...WEEKDAY_BUCKETS },
  friday: { ...WEEKDAY_BUCKETS },
  saturday: { ...WEEKEND_BUCKETS },
  sunday: { ...WEEKEND_BUCKETS },
};

module.exports = { DEFAULT_MUSIC_TRACKS, DEFAULT_MUSIC_SCHEDULE };
