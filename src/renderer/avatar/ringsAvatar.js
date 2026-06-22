// src/renderer/avatar/ringsAvatar.js
function mountRingsAvatar(mountEl) {
  mountEl.innerHTML = `
    <div class="ring-stage">
      <div class="ring outer"></div>
      <div class="ring middle"></div>
      <div class="ring inner"></div>
      <div class="core"></div>
    </div>`;
  const stage = mountEl.querySelector('.ring-stage');
  return {
    setState(state) {
      stage.classList.toggle('speaking', state === 'speaking');
      stage.classList.toggle('listening', state === 'listening');
      stage.classList.toggle('processing', state === 'processing');
    },
    setLevel(level) {
      stage.style.setProperty('--level', level);
    },
    setOuterLevel(level) {
      stage.style.setProperty('--outer-level', level);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { mountRingsAvatar };
