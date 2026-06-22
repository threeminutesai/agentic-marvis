// src/renderer/avatar/ringsAvatar.js
function mountRingsAvatar(mountEl) {
  const mountVisualizer = typeof module !== 'undefined'
    ? require('./musicVisualizerRing').mountMusicVisualizerRing
    : mountMusicVisualizerRing;

  mountEl.innerHTML = `
    <div class="ring-stage">
      <div class="ring outer"></div>
      <div class="ring middle"></div>
      <div class="ring inner"></div>
      <div class="core"></div>
    </div>`;
  const stage = mountEl.querySelector('.ring-stage');
  const visualizer = mountVisualizer(stage, { radius: 98, barLength: 15 });
  return {
    setState(state) {
      stage.classList.toggle('speaking', state === 'speaking');
      stage.classList.toggle('listening', state === 'listening');
      stage.classList.toggle('processing', state === 'processing');
    },
    setLevel(level) {
      stage.style.setProperty('--level', level);
    },
    setOuterLevel(levels) {
      visualizer.setLevels(levels);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { mountRingsAvatar };
