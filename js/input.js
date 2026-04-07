// Input: keyboard + touch zones (left/right halves of the screen).
import { logInput } from './diagnostics.js';

export const input = {
  left: false,
  right: false,
  down: false,
  restart: false,
  mode: 'keyboard', // 'keyboard' | 'touch'
};

const isTouchDevice = () =>
  ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;

// Track which side each active pointer is holding so two-finger play works.
const pointerSides = new Map(); // pointerId -> 'left' | 'right'

export function initInput() {
  if (isTouchDevice()) setMode('touch');
  else setMode('keyboard');

  // Keyboard.
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': if (!input.left) logInput('L+'); input.left = true; break;
      case 'ArrowRight': case 'd': case 'D': if (!input.right) logInput('R+'); input.right = true; break;
      case 'ArrowDown': case 's': case 'S': if (!input.down) logInput('D+'); input.down = true; break;
      case ' ': case 'Enter': input.restart = true; break;
      default: return;
    }
    if (input.mode !== 'keyboard') setMode('keyboard');
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': if (input.left) logInput('L-'); input.left = false; break;
      case 'ArrowRight': case 'd': case 'D': if (input.right) logInput('R-'); input.right = false; break;
      case 'ArrowDown': case 's': case 'S': if (input.down) logInput('D-'); input.down = false; break;
      case ' ': case 'Enter': input.restart = false; break;
    }
  });

  // Touch zones - two invisible halves covering the whole viewport.
  const wrap = document.getElementById('touch-zones');
  for (const zone of wrap.querySelectorAll('.tzone')) {
    const dir = zone.dataset.dir;

    // Block native touch behaviors on the zones (double-tap zoom, scroll).
    zone.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    zone.addEventListener('touchend',   (e) => e.preventDefault(), { passive: false });
    zone.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

    zone.addEventListener('pointerdown', (e) => {
      // Mouse pointers should never steer or restart - desktop uses keyboard
      // for play, and clicks for UI hit regions handled in main.js.
      if (e.pointerType === 'mouse') return;

      // Restart from title/gameover - cleared each frame after consumption.
      input.restart = true;
      setTimeout(() => { input.restart = false; }, 100);

      pointerSides.set(e.pointerId, dir);
      if (dir === 'left') input.left = true;
      else input.right = true;
      try { zone.setPointerCapture(e.pointerId); } catch {}
      if (input.mode !== 'touch') setMode('touch');
      e.preventDefault();
    });

    const release = (e) => {
      const side = pointerSides.get(e.pointerId);
      if (!side) return;
      pointerSides.delete(e.pointerId);
      // Only clear if no other pointer is still holding that side.
      const stillHeld = [...pointerSides.values()].includes(side);
      if (!stillHeld) {
        if (side === 'left') input.left = false;
        else input.right = false;
      }
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
    zone.addEventListener('lostpointercapture', release);
  }
}

function setMode(mode) {
  input.mode = mode;
  // Touch zones stay live in either mode (so a touchscreen laptop works
  // with both); we just don't visually do anything different.
}
