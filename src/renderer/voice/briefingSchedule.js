// Pure bucket-comparison logic for the "voice briefing frequency" setting.
// Each frequency maps to a calendar-aligned bucket size; the briefing voice
// only triggers when `now` falls in a different bucket than `lastTriggeredAt`.

const BUCKET_HOURS = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '1d': 24,
};

function bucketKey(date, frequency) {
  const hours = BUCKET_HOURS[frequency];
  if (!hours) return null;
  const bucketIndex = Math.floor(date.getHours() / hours);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${bucketIndex}`;
}

function shouldTriggerBriefingVoice(frequency, lastTriggeredAt, now = new Date()) {
  if (frequency === 'never') return false;
  if (!lastTriggeredAt) return true;
  if (!BUCKET_HOURS[frequency]) return true;

  const last = new Date(lastTriggeredAt);
  if (Number.isNaN(last.getTime())) return true;

  return bucketKey(last, frequency) !== bucketKey(now, frequency);
}

if (typeof module !== 'undefined') module.exports = { shouldTriggerBriefingVoice };
