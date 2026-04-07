import { initInput, input } from './input.js';
import { createGame, updateGame, loadLeaderboard, forceEndRun, setLeaderboardTab } from './game.js';
import { render, hitRegions } from './render.js';
import { getStoredName, setStoredName } from './leaderboard.js';
import { buildDiagnosticsMeta, logInput } from './diagnostics.js';
import { CHANGELOG, LATEST_VERSION } from './changelog.js';
import { createSession } from './net.js';

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
let game = createGame();

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

// "what's new" indicator: pulse the ? button until the user opens the modal
// after a release. Tracked in localStorage by version string.
const CHANGELOG_SEEN_KEY = 'skifree.changelogSeen';
const helpBtn = document.getElementById('help-btn');
function refreshChangelogBadge() {
  const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
  if (seen !== LATEST_VERSION) {
    helpBtn.classList.add('has-update');
    helpBtn.setAttribute('title', "what's new - tap to see updates");
  } else {
    helpBtn.classList.remove('has-update');
    helpBtn.setAttribute('title', 'report a bug or suggestion');
  }
}
function markChangelogSeen() {
  localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_VERSION);
  refreshChangelogBadge();
}
refreshChangelogBadge();

document.getElementById('help-btn').addEventListener('click', () => {
  openFeedback();
  markChangelogSeen();
});
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
  if (e.target && e.target.closest && e.target.closest('#top-right, #feedback-modal, #mp-modal, #changelog-modal, #title-button')) return;
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
  } else if (r.action === 'multiplayer') {
    openMpModal();
    return;
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

// Multiplayer lobby modal wiring.
let mpSession = null;

function openMpModal() {
  showMpStage('choose');
  document.getElementById('mp-modal').classList.remove('hidden');
}
function closeMpModal() {
  document.getElementById('mp-modal').classList.add('hidden');
  if (mpSession && !mpSession.closed) { mpSession.close(); }
  mpSession = null;
}
function showMpStage(stage) {
  ['choose', 'join', 'lobby'].forEach(s => {
    const el = document.getElementById('mp-stage-' + s);
    if (!el) return;
    if (s === stage) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}
function setMpStatus(text) {
  const el = document.getElementById('mp-status');
  if (el) el.textContent = text;
}
function showLobbyStage(code) {
  showMpStage('lobby');
  document.getElementById('mp-code-display').textContent = code;
  setMpStatus('Waiting for friend...');
  document.getElementById('mp-ready').disabled = true;
}

async function startHost() {
  try {
    mpSession = createSession();
    wireMpSession();
    const code = await mpSession.host();
    showLobbyStage(code);
  } catch (err) {
    setMpStatus('Failed to host: ' + err.message);
  }
}

function startJoin() {
  showMpStage('join');
  setTimeout(() => document.getElementById('mp-code-input').focus(), 50);
}

function commitJoin() {
  const code = (document.getElementById('mp-code-input').value || '').toUpperCase().trim();
  if (!/^[A-Z]{4}$/.test(code)) {
    setMpStatus('Code must be 4 letters');
    return;
  }
  mpSession = createSession();
  wireMpSession();
  mpSession.join(code);
  showLobbyStage(code);
}

function wireMpSession() {
  mpSession.on('welcome', () => {
    if (mpSession.peer) {
      setMpStatus(`Joined ${mpSession.peer.name}'s run`);
      document.getElementById('mp-ready').disabled = false;
    }
  });
  mpSession.on('peerJoined', e => {
    setMpStatus(`${e.name} joined - ready up!`);
    document.getElementById('mp-ready').disabled = false;
  });
  mpSession.on('peerReady', () => {
    setMpStatus('Friend is ready...');
  });
  mpSession.on('start', e => {
    document.getElementById('mp-modal').classList.add('hidden');
    if (typeof window.startMultiplayerGame === 'function') {
      window.startMultiplayerGame(mpSession.seed, mpSession);
    } else {
      console.warn('[mp] startMultiplayerGame not yet implemented (WS4)');
    }
  });
  mpSession.on('peerLeft', () => {
    setMpStatus('Friend left');
    document.getElementById('mp-ready').disabled = true;
  });
  mpSession.on('error', () => {
    setMpStatus('Connection error');
  });
  mpSession.on('close', () => {
    if (!document.getElementById('mp-modal').classList.contains('hidden')) {
      setMpStatus('Disconnected');
    }
  });
}

document.getElementById('mp-host').addEventListener('click', startHost);
document.getElementById('mp-join').addEventListener('click', startJoin);
document.getElementById('mp-join-go').addEventListener('click', commitJoin);
document.getElementById('mp-ready').addEventListener('click', () => {
  if (mpSession) {
    mpSession.sendReady();
    setMpStatus("You're ready - waiting on friend...");
    document.getElementById('mp-ready').disabled = true;
  }
});
document.getElementById('mp-cancel').addEventListener('click', closeMpModal);
document.getElementById('mp-code-input').addEventListener('keydown', (e) => e.stopPropagation());

// Bridge from the lobby (WS3) into actual gameplay (WS4). Replaces the
// current game object with a fresh seeded one, attaches the live session,
// and wires gameplay-specific listeners onto it.
window.startMultiplayerGame = function(seed, session) {
  game = createGame(seed >>> 0);
  game.mode = 'mp';
  game.session = session;
  game.isHost = !!session.isHost;
  game.remote = {
    id: session.peer ? session.peer.id : null,
    name: session.peer ? session.peer.name : 'P2',
    x: 0, y: 0,
    state: 'straight',
    score: 0,
    alive: true,
    lastT: 0, prevX: 0, prevY: 0, prevT: 0,
    lastSeq: -1,
  };
  game.remoteYeti = { active: false, x: 0, y: 0 };
  // Drop directly into a run.
  input.restart = true;
  setTimeout(() => { input.restart = false; }, 80);

  session.on('state', e => {
    if (!game.remote) return;
    if (typeof e.seq === 'number' && e.seq < game.remote.lastSeq) return;
    if (typeof e.seq === 'number') game.remote.lastSeq = e.seq;
    game.remote.prevX = game.remote.x;
    game.remote.prevY = game.remote.y;
    game.remote.prevT = game.remote.lastT || (performance.now() / 1000);
    game.remote.x = e.x;
    game.remote.y = e.y;
    game.remote.state = e.state;
    game.remote.score = e.score || 0;
    game.remote.lastT = performance.now() / 1000;
    if ((!game.remote.name || game.remote.name === 'P2') && session.peer) {
      game.remote.name = session.peer.name;
    }
    // Non-host: yeti rides along on the host's broadcast.
    if (!game.isHost && e.yeti) {
      game.remoteYeti.active = !!e.yeti.active;
      game.remoteYeti.x = e.yeti.x;
      game.remoteYeti.y = e.yeti.y;
      game.yeti.active = game.remoteYeti.active;
      game.yeti.x = game.remoteYeti.x;
      game.yeti.y = game.remoteYeti.y;
    }
  });
  session.on('died', () => {
    if (!game.remote) return;
    game.remote.alive = false;
    // If we were spectating waiting for the peer to die, transition to gameover.
    if (game.spectating && game.state === 'playing') {
      game.state = 'gameover';
      game.hint = pickHintFallback();
    }
  });
  session.on('peerLeft', e => {
    game.peerLeft = true;
    // If we are the joiner, the peer that just left was the host. Spec: hard
    // reset to title and reopen the lobby modal.
    if (!game.isHost) {
      try { session.close(); } catch {}
      game = createGame();
      game.state = 'title';
      if (typeof openMpModal === 'function') openMpModal();
      return;
    }
    // Host whose joiner left: keep playing solo-ish, but leaderboard stays
    // suppressed for the rest of the run (game.mode is still 'mp').
  });
};

// Tiny shim so the inline 'died' handler above can refresh the gameover hint
// without exporting pickHint from game.js.
function pickHintFallback() { return game.hint || ''; }

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
