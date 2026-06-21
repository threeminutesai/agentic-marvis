function createMusicController() {
  let catalog = { tracks: [], playlists: [], schedule: {} };
  let baseVolume = 0.6;
  let duckFactor = 1;
  let queue = [];
  let queueIndex = 0;
  let currentSlotKey = '';
  let audio = null;
  let checkTimer = null;
  let isPausedByUser = false;

  function effectiveVolume() {
    return Math.max(0, Math.min(1, baseVolume * duckFactor));
  }

  function setVolume(v) {
    baseVolume = Math.max(0, Math.min(1, v));
    if (audio) audio.volume = effectiveVolume();
  }

  function duck() {
    duckFactor = 0.2;
    if (audio) audio.volume = effectiveVolume();
  }

  function unduck() {
    duckFactor = 1;
    if (audio) audio.volume = effectiveVolume();
  }

  function trackById(trackId) {
    return catalog.tracks.find((t) => t.id === trackId) || null;
  }

  function buildQueueForPlaylist(playlist) {
    if (!playlist) return [];
    const tracks = playlist.trackIds.map(trackById).filter(Boolean);
    return shuffleTracks(tracks);
  }

  function onTrackEnded() {
    if (!queue.length) return;
    queueIndex = (queueIndex + 1) % queue.length;
    if (queueIndex === 0) queue = shuffleTracks(queue);
    playCurrentTrack();
  }

  function playCurrentTrack() {
    const track = queue[queueIndex];
    if (audio) {
      audio.pause();
      audio.removeEventListener('ended', onTrackEnded);
      audio.removeEventListener('error', onTrackEnded);
      audio = null;
    }
    if (!track || !track.fileUrl || isPausedByUser) return;
    audio = new Audio(track.fileUrl);
    audio.volume = effectiveVolume();
    audio.addEventListener('ended', onTrackEnded);
    // A missing/corrupt file on disk fires 'error', not 'ended' - route it
    // through the same advance-to-next-track path rather than stalling.
    audio.addEventListener('error', onTrackEnded);
    audio.play().catch(() => {
      if (audio) {
        audio.removeEventListener('ended', onTrackEnded);
        audio.removeEventListener('error', onTrackEnded);
        audio = null;
      }
    });
  }

  function loadSlot(day, bucket) {
    const slotKey = `${day}:${bucket}`;
    if (slotKey === currentSlotKey) return;
    currentSlotKey = slotKey;
    if (isPausedByUser) return;
    const playlist = getPlaylistForSlot(catalog, day, bucket);
    queue = buildQueueForPlaylist(playlist);
    queueIndex = 0;
    playCurrentTrack();
  }

  function checkSchedule() {
    const { day, bucket } = getActiveSlot(new Date());
    loadSlot(day, bucket);
  }

  function start(initialCatalog) {
    catalog = initialCatalog || catalog;
    isPausedByUser = false;
    currentSlotKey = '';
    checkSchedule();
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(checkSchedule, 60 * 1000);
  }

  function setCatalog(nextCatalog) {
    catalog = nextCatalog;
    currentSlotKey = '';
    checkSchedule();
  }

  function pause() {
    isPausedByUser = true;
    if (audio) audio.pause();
  }

  function resume() {
    isPausedByUser = false;
    const { day, bucket } = getActiveSlot(new Date());
    const playlist = getPlaylistForSlot(catalog, day, bucket);
    queue = buildQueueForPlaylist(playlist);
    queueIndex = 0;
    currentSlotKey = `${day}:${bucket}`;
    playCurrentTrack();
  }

  function skip() {
    if (!queue.length) return;
    onTrackEnded();
  }

  function getNowPlaying() {
    const track = queue[queueIndex];
    return track ? { name: track.originalName, isPaused: isPausedByUser } : null;
  }

  return { start, setCatalog, setVolume, duck, unduck, pause, resume, skip, getNowPlaying };
}

if (typeof module !== 'undefined') module.exports = { createMusicController };
