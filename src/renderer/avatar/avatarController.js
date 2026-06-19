// src/renderer/avatar/avatarController.js
function createAvatarController({ mountEl, style }) {
  const mountRings = typeof module !== 'undefined' ? require('./ringsAvatar').mountRingsAvatar : mountRingsAvatar;
  const mountBrain = typeof module !== 'undefined' ? require('./brainAvatar').mountBrainAvatar : mountBrainAvatar;
  const mountFn = style === 'brain' ? mountBrain : mountRings;

  const preset = mountFn(mountEl);

  return {
    setState(state) {
      preset.setState(state);
    },
    setLevel(level) {
      if (preset.setLevel) preset.setLevel(level);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createAvatarController };
