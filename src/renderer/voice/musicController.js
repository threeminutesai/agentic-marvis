// frequencyBinCount is fftSize / 2 - keep these in sync so each bar maps to
// exactly one frequency bin with no averaging. 128 bars creates a dense histogram.
const BAR_COUNT = 128;
const ANALYSER_FFT_SIZE = BAR_COUNT * 2;

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
  let audioCtx = null;
  let leveler = null;
  let levelCallback = null;
  let analyser = null;
  let analyserData = null;
  let rafId = null;

  function effectiveVolume() {
    return Math.max(0, Math.min(1, baseVolume * duckFactor));
  }

  function setOnLevel(cb) {
    levelCallback = cb;
  }

  function emitLevel(level) {
    if (levelCallback) levelCallback(level);
  }

  // Drives the avatar's circular music-bar visualizer: one amplitude band
  // per bar, read straight off the frequency-domain analyser data (one bin
  // per bar - BAR_COUNT is chosen to match analyser.fftSize / 2 exactly, no
  // averaging/grouping needed). Reads continuously rather than only while a
  // track is "playing" - a paused or silent source naturally reads back
  // near-zero, so this doubles as the reset-to-idle path without needing
  // separate pause/stop wiring.
  function startLevelLoop() {
    if (rafId !== null) return;
    const tick = () => {
      if (!analyser || !analyserData) {
        emitLevel(new Array(BAR_COUNT).fill(0));
      } else {
        analyser.getByteFrequencyData(analyserData);
        // The analyser sits downstream of the <audio> element's own .volume,
        // which the browser applies before the signal ever reaches the Web
        // Audio graph - at a quiet Music Volume setting the raw magnitudes
        // are tiny even for a loud track. Divide out the current volume
        // (floored, so near-zero volume doesn't blow this up) so the bars
        // reflect the track's relative loudness rather than the slider
        // position.
        const volumeCompensation = 1 / Math.max(effectiveVolume(), 0.15);
        const levels = new Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          levels[i] = Math.min(1, (analyserData[i] / 255) * volumeCompensation * 1.6);
        }
        emitLevel(levels);
      }
      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  // Different tracks are mastered at wildly different loudness levels, so
  // even at a fixed Music Volume some sound too quiet and others too loud.
  // Routes playback through a compressor (narrows the gap between loud and
  // quiet passages) plus a modest makeup gain (brings quieter tracks back
  // up to an audible level) so tracks land closer to the same perceived
  // volume without the user needing to ride the volume slider per track.
  function ensureLeveler() {
    if (leveler) return leveler;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const compressor = audioCtx.createDynamicsCompressor();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      // Snappier response than the default 0.8 smoothing, so the bars
      // visibly "dance" with the beat instead of gliding.
      analyser.smoothingTimeConstant = 0.6;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      const makeupGain = audioCtx.createGain();
      makeupGain.gain.value = 1.6;
      compressor.connect(analyser);
      analyser.connect(makeupGain);
      makeupGain.connect(audioCtx.destination);
      leveler = { compressor, makeupGain };
      startLevelLoop();
    } catch {
      leveler = null;
    }
    return leveler;
  }

  function routeThroughLeveler(audioEl) {
    const graph = ensureLeveler();
    if (!graph) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(graph.compressor);
    } catch {
      // Fall back to the element's own direct output (e.g. if the audio
      // graph couldn't be set up) - playback still works, just unleveled.
    }
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
    routeThroughLeveler(audio);
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

  return { start, setCatalog, setVolume, duck, unduck, pause, resume, skip, getNowPlaying, applyLeveling: routeThroughLeveler, setOnLevel };
}

if (typeof module !== 'undefined') module.exports = { createMusicController };
