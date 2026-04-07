import { initInput, input } from './input.js';
import { createGame, updateGame } from './game.js';
import { render } from './render.js';

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

initInput();
const game = createGame();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateGame(game, input, viewport, dt);
  render(ctx, viewport, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
