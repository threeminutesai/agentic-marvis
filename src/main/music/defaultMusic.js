// Slot-to-file mapping for the default schedule.
// fileName is the track id — no separate id field needed.
const DEFAULT_MUSIC_TRACKS = [
  { slot: 'earlyMorning', fileName: 'johan_benitez99co-day-516015.mp3',                                          artist: 'Johan Benitez' },
  { slot: 'morning',      fileName: 'fatbunny-working-488068.mp3',                                               artist: 'FatBunny' },
  { slot: 'afternoon',    fileName: 'u_98o9hlkn7r-corporate-financial-success-272259.mp3',                        artist: 'Corporate Music' },
  { slot: 'evening',      fileName: 'jourinhannah-romance-234850.mp3',                                           artist: 'Jorin Hannah' },
  { slot: 'midnight',     fileName: 'the_mountain-cosmic-study-143288.mp3',                                      artist: 'The Mountain' },
  { slot: 'weekendChill', fileName: 'fassounds-calm-mind-chill-lofi-beat-background-music-259700.mp3',           artist: 'Fassounds' },
  { slot: 'weekendWork',  fileName: 'openmindaudio-working-class-country-anthem-worn-hands-538391.mp3',          artist: 'Open Mind Audio' },
];

const WEEKDAY_SLOTS = ['earlyMorning', 'morning', 'afternoon', 'evening', 'midnight'];
const WEEKEND_SLOTS = ['weekendChill', 'weekendWork'];

const DEFAULT_MUSIC_SCHEDULE = {
  monday:    { earlyMorning: 'pl_earlyMorning', morning: 'pl_morning', afternoon: 'pl_afternoon', evening: 'pl_evening', midnight: 'pl_midnight' },
  tuesday:   { earlyMorning: 'pl_earlyMorning', morning: 'pl_morning', afternoon: 'pl_afternoon', evening: 'pl_evening', midnight: 'pl_midnight' },
  wednesday: { earlyMorning: 'pl_earlyMorning', morning: 'pl_morning', afternoon: 'pl_afternoon', evening: 'pl_evening', midnight: 'pl_midnight' },
  thursday:  { earlyMorning: 'pl_earlyMorning', morning: 'pl_morning', afternoon: 'pl_afternoon', evening: 'pl_evening', midnight: 'pl_midnight' },
  friday:    { earlyMorning: 'pl_earlyMorning', morning: 'pl_morning', afternoon: 'pl_afternoon', evening: 'pl_evening', midnight: 'pl_midnight' },
  saturday:  { earlyMorning: 'pl_weekend', morning: 'pl_weekend', afternoon: 'pl_weekend', evening: 'pl_weekend', midnight: 'pl_weekend' },
  sunday:    { earlyMorning: 'pl_weekend', morning: 'pl_weekend', afternoon: 'pl_weekend', evening: 'pl_weekend', midnight: 'pl_weekend' },
};

module.exports = { DEFAULT_MUSIC_TRACKS, DEFAULT_MUSIC_SCHEDULE, WEEKDAY_SLOTS, WEEKEND_SLOTS };
