// Input: keyboard + touch, with auto-detect of which UI to show.

export const input = {
  left: false,
  right: false,
  down: false,
  restart: false,
  mode: 'keyboard', // 'keyboard' | 'touch'
};

const isTouchDevice = () =>
  ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;

export function initInput() {
  // Auto-detect initial mode.
  if (isTouchDevice()) {
    setMode('touch');
  } else {
    setMode('keyboard');
  }

  // Keyboard.
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        input.left = true; break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        input.right = true; break;
      case 'ArrowDown':
      case 's':
      case 'S':
        input.down = true; break;
      case ' ':
      case 'Enter':
        input.restart = true; break;
      default: return;
    }
    if (input.mode !== 'keyboard') setMode('keyboard');
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': input.left = false; break;
      case 'ArrowRight': case 'd': case 'D': input.right = false; break;
      case 'ArrowDown': case 's': case 'S': input.down = false; break;
      case ' ': case 'Enter': input.restart = false; break;
    }
  });

  // Touch buttons.
  const wrap = document.getElementById('touch-controls');
  const setBtn = (dir, val) => {
    if (dir === 'left') input.left = val;
    else if (dir === 'right') input.right = val;
    else if (dir === 'down') input.down = val;
  };

  for (const btn of wrap.querySelectorAll('.tbtn')) {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => {
      btn.setPointerCapture(e.pointerId);
      setBtn(dir, true);
      if (input.mode !== 'touch') setMode('touch');
      e.preventDefault();
    });
    const release = (e) => { setBtn(dir, false); e.preventDefault?.(); };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  // Tapping anywhere on canvas also acts as "restart" when on touch.
  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', (e) => {
    input.restart = true;
    setTimeout(() => { input.restart = false; }, 100);
  });
}

function setMode(mode) {
  input.mode = mode;
  const wrap = document.getElementById('touch-controls');
  if (mode === 'touch') wrap.classList.remove('hidden');
  else wrap.classList.add('hidden');
}
