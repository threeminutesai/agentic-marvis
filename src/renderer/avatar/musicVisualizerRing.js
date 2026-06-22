// src/renderer/avatar/musicVisualizerRing.js
// A ring of radial bars (SVG <line> elements) around an avatar, each
// independently driven by one frequency band. The ring rotates with speed
// tied to the overall music energy - quiet = slow spin, loud = fast spin.
// Shared between both avatar presets so the "dancing" look is consistent.
function mountMusicVisualizerRing(containerEl, { radius = 95, barLength = 22, barCount = 128 } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const size = (radius + barLength) * 2;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('music-bars');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  // Centering is handled by CSS: position: absolute; top: 50%; left: 50%;
  // plus transform: translate(-50%, -50%) rotate(...) - don't add margins here.

  const cx = size / 2;
  const cy = size / 2;
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * 2 * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x1 = cx + cos * radius;
    const y1 = cy + sin * radius;
    const line = document.createElementNS(NS, 'line');
    line.classList.add('music-bar');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x1);
    line.setAttribute('y2', y1);

    // Gradient: green at top (0°) → cyan (90°) → magenta (180°) → cyan (270°) → green (360°)
    const hue = (i / barCount) * 360;
    let color;
    if (hue < 120) {
      color = `hsl(${hue}, 100%, 50%)`; // green to cyan
    } else if (hue < 240) {
      color = `hsl(${hue}, 100%, 50%)`; // cyan to magenta to cyan
    } else {
      color = `hsl(${hue}, 100%, 50%)`; // cyan back to green
    }
    line.setAttribute('stroke', color);

    svg.appendChild(line);
    bars.push({ line, cos, sin, x1, y1 });
  }
  containerEl.appendChild(svg);

  let currentRotation = 0;
  // Spin speed in degrees per frame (60 fps). Base matches avatar's outer ring (11s rotation).
  // Music energy modulates this between slower (quiet) and faster (loud): 11s to 7s.
  let targetSpinSpeedDegPerFrame = 360 / (11 * 60);

  function animate() {
    currentRotation += targetSpinSpeedDegPerFrame;
    svg.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(animate);
    }
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    animate();
  }

  function setLevels(levels) {
    // Update bar heights
    for (let i = 0; i < bars.length; i++) {
      const level = Math.max(0, Math.min(1, (levels && levels[i]) || 0));
      const len = 3 + level * barLength;
      const { line, cos, sin, x1, y1 } = bars[i];
      line.setAttribute('x2', x1 + cos * len);
      line.setAttribute('y2', y1 + sin * len);
    }

    // Modulate spin speed based on overall energy (RMS of all bands).
    // Quiet: 11s per rotation, Loud: 7s per rotation (subtle variation, not drastic).
    if (levels && levels.length > 0) {
      let sumSquares = 0;
      for (let i = 0; i < levels.length; i++) {
        sumSquares += levels[i] * levels[i];
      }
      const energy = Math.sqrt(sumSquares / levels.length);
      // Map [0, 1] energy to [11, 7] seconds per rotation.
      const secondsPerRotation = 11 - energy * 4;
      targetSpinSpeedDegPerFrame = 360 / (secondsPerRotation * 60);
    }
  }

  return { el: svg, setLevels };
}

if (typeof module !== 'undefined') module.exports = { mountMusicVisualizerRing };
