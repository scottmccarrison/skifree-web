import { initInput, input } from './input.js';
import { createGame, updateGame, loadLeaderboard, forceEndRun, setLeaderboardTab } from './game.js';
import { render, hitRegions } from './render.js';
import { getStoredName, setStoredName } from './leaderboard.js';
import { buildDiagnosticsMeta, logInput } from './diagnostics.js';
import { CHANGELOG } from './changelog.js';

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

// Name input wiring (initials, uppercased).
const nameInput = document.getElementById('name-input');
nameInput.value = getStoredName().toUpperCase();
nameInput.addEventListener('input', () => {
  nameInput.value = nameInput.value.toUpperCase();
  setStoredName(nameInput.value);
});
// Stop key events on the name input from steering the skier.
nameInput.addEventListener('keydown', (e) => e.stopPropagation());

loadLeaderboard(game);

// Help button - opens an in-page modal that POSTs to /api/feedback.
const fbModal = document.getElementById('feedback-modal');
const fbText = document.getElementById('fb-text');
const fbStatus = document.getElementById('fb-status');
const fbSend = document.getElementById('fb-send');
const fbCancel = document.getElementById('fb-cancel');

function openFeedback() {
  fbStatus.textContent = '';
  fbText.value = '';
  fbSend.disabled = false;
  fbCancel.disabled = false;
  fbModal.classList.remove('hidden');
  setTimeout(() => fbText.focus(), 0);
}

function closeFeedback() {
  fbModal.classList.add('hidden');
}

document.getElementById('help-btn').addEventListener('click', openFeedback);
fbCancel.addEventListener('click', closeFeedback);
fbModal.addEventListener('click', (e) => { if (e.target === fbModal) closeFeedback(); });
fbText.addEventListener('keydown', (e) => e.stopPropagation());

fbSend.addEventListener('click', async () => {
  const message = fbText.value.trim();
  if (message.length < 3) {
    fbStatus.textContent = 'add a few more words first';
    return;
  }
  fbSend.disabled = true;
  fbCancel.disabled = true;
  fbStatus.textContent = 'sending...';
  try {
    const apiBase = location.pathname.startsWith('/ski') ? '/ski/api' : '/api';
    const r = await fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        meta: buildDiagnosticsMeta(game),
      }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    fbStatus.textContent = 'thanks! sent.';
    setTimeout(closeFeedback, 900);
  } catch (e) {
    fbStatus.textContent = 'failed to send - try again later';
    fbSend.disabled = false;
    fbCancel.disabled = false;
  }
});

// SKI FREE title button - ends the run and shows the leaderboard.
document.getElementById('title-button').addEventListener('click', () => {
  forceEndRun(game);
});

// UI hit-region dispatch. Uses pointerup (not click) because iOS Safari
// doesn't synthesize click events on the canvas reliably for touch input.
window.addEventListener('pointerup', (e) => {
  if (game.state === 'playing') return;
  // Don't hijack interactions with real DOM controls.
  if (e.target && e.target.closest && e.target.closest('#top-right, #feedback-modal, #changelog-modal, #title-button')) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  for (const r of hitRegions) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      handleHit(r);
      e.stopPropagation();
      return;
    }
  }
});

function handleHit(r) {
  if (r.action === 'setTab') {
    setLeaderboardTab(game, r.data);
  } else if (r.action === 'openChangelog') {
    openChangelog();
  } else if (r.action === 'restart') {
    // Pulse the input.restart flag for one frame so updateGame's existing
    // title/gameover handler picks it up and starts a run.
    input.restart = true;
    setTimeout(() => { input.restart = false; }, 80);
  }
}

// Changelog modal: populate body once, wire close handlers.
const clModal = document.getElementById('changelog-modal');
const clBody = document.getElementById('changelog-body');
const clClose = document.getElementById('changelog-close');

function renderChangelog() {
  if (!clBody) return;
  const html = CHANGELOG.map(v => {
    const items = v.items.map(i => `<li>${escapeHtml(i)}</li>`).join('');
    return `<div class="cl-version"><div class="cl-ver">${escapeHtml(v.version)}</div><ul>${items}</ul></div>`;
  }).join('');
  clBody.innerHTML = html;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
renderChangelog();

function openChangelog() {
  if (clModal) clModal.classList.remove('hidden');
}
function closeChangelog() {
  if (clModal) clModal.classList.add('hidden');
}
if (clClose) clClose.addEventListener('click', closeChangelog);
if (clModal) clModal.addEventListener('click', (e) => { if (e.target === clModal) closeChangelog(); });

// Touch zones must not absorb taps on the title/gameover panel - otherwise
// the user can't hit tab buttons or the gift icon. Toggle pointer-events
// on the wrapper based on game state.
const touchZonesEl = document.getElementById('touch-zones');
function syncTouchZones() {
  if (!touchZonesEl) return;
  touchZonesEl.classList.toggle('disabled', game.state !== 'playing');
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateGame(game, input, viewport, dt);
  render(ctx, viewport, game);
  syncTouchZones();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
