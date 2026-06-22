// src/renderer/avatar/brainAvatar.js
function mountBrainAvatar(mountEl) {
  mountEl.innerHTML = `
    <div class="brain-stage">
      <div class="brain-outer-ring"></div>
      <div class="brain-core">
        <div class="brain-glow"></div>
        <svg viewBox="0 0 100 100">
          <path class="vein" d="M20,50 Q35,20 50,50 T80,50"/>
          <path class="vein" d="M15,40 Q40,60 50,30 T85,45"/>
          <path class="vein" d="M25,65 Q45,40 60,65 T75,35"/>
          <circle cx="50" cy="50" r="8" fill="#5ad1e6" opacity="0.8"/>
        </svg>
      </div>
    </div>`;
  const stage = mountEl.querySelector('.brain-stage');
  const core = mountEl.querySelector('.brain-core');
  return {
    setState(state) {
      core.classList.toggle('speaking', state === 'speaking');
      core.classList.toggle('listening', state === 'listening');
      core.classList.toggle('processing', state === 'processing');
    },
    setLevel(level) {
      core.style.setProperty('--level', level);
    },
    setOuterLevel(level) {
      stage.style.setProperty('--outer-level', level);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { mountBrainAvatar };
