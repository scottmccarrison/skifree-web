import { initInput, input } from './input.js';
import { createGame, updateGame, loadLeaderboard, forceEndRun } from './game.js';
import { render } from './render.js';
import { getStoredName, setStoredName } from './leaderboard.js';
import { drawPlayer } from './sprites.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const viewport = { w: 0, h: 0, dpr: 1 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewport.dpr = dpr;
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
  canvas.width = Math.floor(viewport.w * dpr);
  canvas.height = Math.floor(viewport.h * dpr);
  canvas.style.width = viewport.w + 'px';
  canvas.style.height = viewport.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// iOS Safari ignores user-scalable=no. Block the double-tap zoom gesture by
// preventing the second tap when it lands within 350ms of the first.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
// Also block pinch-zoom gestures.
document.addEventListener('gesturestart', (e) => e.preventDefault());

initInput();
const game = createGame();

// Name input wiring.
const nameInput = document.getElementById('name-input');
nameInput.value = getStoredName();
nameInput.addEventListener('input', () => setStoredName(nameInput.value));
// Stop key events on the name input from steering the skier.
nameInput.addEventListener('keydown', (e) => e.stopPropagation());

loadLeaderboard(game);

// Help button - opens a prefilled GitHub issue.
document.getElementById('help-btn').addEventListener('click', () => {
  const url = 'https://github.com/scottmccarrison/skifree-web/issues/new'
    + '?title=' + encodeURIComponent('feedback: ')
    + '&body=' + encodeURIComponent(
        'What happened or what would you like to change?\n\n\n'
        + '---\n'
        + `device: ${navigator.userAgent}\n`
        + `viewport: ${window.innerWidth}x${window.innerHeight}\n`
      );
  window.open(url, '_blank', 'noopener');
});

// End button - triggers game over so the leaderboard shows.
document.getElementById('end-btn').addEventListener('click', () => {
  forceEndRun(game);
});

// Draw the crashed-skier icon into the end button.
const iconCanvas = document.getElementById('end-icon');
const iconCtx = iconCanvas.getContext('2d');
iconCtx.save();
iconCtx.translate(iconCanvas.width / 2, iconCanvas.height / 2 + 2);
iconCtx.scale(0.7, 0.7);
drawPlayer(iconCtx, 'crashed');
iconCtx.restore();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateGame(game, input, viewport, dt);
  render(ctx, viewport, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
