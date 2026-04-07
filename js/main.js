import { initInput, input } from './input.js';
import { createGame, updateGame, loadLeaderboard, forceEndRun, forceGameOver, setLeaderboardTab } from './game.js';
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
  const modal = document.getElementById('mp-modal');
  modal.classList.remove('hidden');
  document.getElementById('mp-code-row').classList.add('hidden');
  document.getElementById('mp-code-display').textContent = '';
  const ready = document.getElementById('mp-ready');
  ready.classList.add('hidden');
  ready.disabled = true;
  setMpStatus('');
  const codeInput = document.getElementById('mp-code-input');
  codeInput.value = '';
  codeInput.disabled = false;
  document.getElementById('mp-host').disabled = false;
  document.getElementById('mp-join-go').disabled = false;
  const cancel = document.getElementById('mp-cancel');
  if (cancel) cancel.disabled = false;
}
function closeMpModal() {
  document.getElementById('mp-modal').classList.add('hidden');
  if (mpSession && !mpSession.closed) { mpSession.close(); }
  mpSession = null;
}
function setMpStatus(text) {
  const el = document.getElementById('mp-status');
  if (el) el.textContent = text || '\u00a0';
}
function setStartStatus(text) {
  setMpStatus(text);
  if (game) game.rematchStatus = text;
}

async function startHost() {
  try {
    mpSession = createSession();
    wireMpSession();
    setMpStatus('Creating room...');
    document.getElementById('mp-host').disabled = true;
    const code = await mpSession.host();
    document.getElementById('mp-code-display').textContent = code;
    document.getElementById('mp-code-row').classList.remove('hidden');
    setMpStatus('Waiting for friend...');
  } catch (err) {
    setMpStatus('Failed to host: ' + err.message);
    document.getElementById('mp-host').disabled = false;
  }
}

function commitJoin() {
  const code = (document.getElementById('mp-code-input').value || '').toUpperCase().trim();
  if (!/^[A-Z]{4}$/.test(code)) {
    setMpStatus('Code must be 4 letters');
    return;
  }
  mpSession = createSession();
  wireMpSession();
  setMpStatus('Joining...');
  mpSession.join(code);
  document.getElementById('mp-host').disabled = true;
  document.getElementById('mp-join-go').disabled = true;
  document.getElementById('mp-code-input').disabled = true;
}

function wireMpSession() {
  mpSession.on('welcome', () => {
    if (mpSession.peer) {
      setMpStatus(`Joined ${mpSession.peer.name}'s run`);
      const ready = document.getElementById('mp-ready');
      ready.classList.remove('hidden');
      ready.disabled = false;
    }
  });
  mpSession.on('peerJoined', e => {
    setMpStatus(`${e.name} joined - ready up!`);
    const ready = document.getElementById('mp-ready');
    ready.classList.remove('hidden');
    ready.disabled = false;
  });
  mpSession.on('peerReady', () => {
    if (game && game.state === 'gameover' && game.mode === 'mp') {
      game.rematchStatus = 'Friend is ready...';
    } else {
      setMpStatus('Friend is ready...');
    }
  });
  mpSession.on('start', e => {
    const ms = (e && typeof e.countdownMs === 'number') ? e.countdownMs : 3000;
    const startSeed = (e && typeof e.seed === 'number') ? e.seed : mpSession.seed;
    const cancelBtn = document.getElementById('mp-cancel');
    if (cancelBtn) cancelBtn.disabled = true;
    const ready = document.getElementById('mp-ready');
    if (ready) ready.style.display = 'none';
    let n = Math.ceil(ms / 1000);
    setStartStatus('Starting in ' + n + '...');
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) setStartStatus('Starting in ' + n + '...');
      else setStartStatus('GO!');
    }, 1000);
    setTimeout(() => {
      clearInterval(tick);
      document.getElementById('mp-modal').classList.add('hidden');
      if (cancelBtn) cancelBtn.disabled = false;
      if (ready) ready.style.display = '';
      if (typeof window.startMultiplayerGame === 'function') {
        window.startMultiplayerGame(startSeed, mpSession);
      } else {
        console.warn('[mp] startMultiplayerGame not yet implemented (WS4)');
      }
    }, ms);
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
  game.remotes = new Map();
  for (const p of (session.roster || [])) {
    if (p.id === session.id) continue;
    game.remotes.set(p.id, {
      id: p.id,
      name: p.name || `anon${p.id}`,
      color: p.color || 0,
      x: 0, y: 0,
      state: 'straight',
      score: 0,
      alive: true,
      prevX: 0, prevY: 0, prevT: 0, lastT: 0, lastSeq: -1,
    });
  }
  game.remoteYeti = { active: false, x: 0, y: 0 };
  // Drop directly into a run.
  input.restart = true;
  setTimeout(() => { input.restart = false; }, 80);

  // Avoid double-registering listeners on rematch (same session reused).
  if (session.__gameplayWired) return;
  session.__gameplayWired = true;

  session.on('state', e => {
    if (typeof e.id !== 'number') return;
    let r = game.remotes.get(e.id);
    if (!r) {
      const meta = (session.roster || []).find(p => p.id === e.id) || {};
      r = {
        id: e.id, name: meta.name || `anon${e.id}`, color: meta.color || 0,
        x: 0, y: 0, state: 'straight', score: 0, alive: true,
        prevX: 0, prevY: 0, prevT: 0, lastT: 0, lastSeq: -1,
      };
      game.remotes.set(e.id, r);
    }
    if (typeof e.seq === 'number' && e.seq < r.lastSeq) return;
    if (typeof e.seq === 'number') r.lastSeq = e.seq;
    r.prevX = r.x;
    r.prevY = r.y;
    r.prevT = r.lastT || (performance.now() / 1000);
    r.x = e.x;
    r.y = e.y;
    if (e.state) r.state = e.state;
    if (typeof e.score === 'number') r.score = e.score;
    r.lastT = performance.now() / 1000;
    // Non-host: yeti rides along on the host's broadcast.
    if (!game.isHost && e.yeti) {
      if (!game.remoteYeti) game.remoteYeti = { active: false, x: 0, y: 0 };
      game.remoteYeti.active = !!e.yeti.active;
      game.remoteYeti.x = e.yeti.x;
      game.remoteYeti.y = e.yeti.y;
      game.yeti.active = game.remoteYeti.active;
      game.yeti.x = game.remoteYeti.x;
      game.yeti.y = game.remoteYeti.y;
    }
  });
  session.on('died', e => {
    if (typeof e.id !== 'number') return;
    const r = game.remotes.get(e.id);
    if (r) r.alive = false;
    let anyAlive = false;
    for (const x of game.remotes.values()) { if (x.alive) { anyAlive = true; break; } }
    const localDead = game.spectating || game.player.state === 'crashed';
    if (!anyAlive && localDead && game.state === 'playing') {
      game.state = 'gameover';
      game.hint = pickHintFallback();
    }
  });
  session.on('peerJoined', e => {
    if (typeof e.id !== 'number') return;
    if (!game.remotes.has(e.id)) {
      game.remotes.set(e.id, {
        id: e.id, name: e.name || `anon${e.id}`, color: e.color || 0,
        x: 0, y: 0, state: 'straight', score: 0, alive: true,
        prevX: 0, prevY: 0, prevT: 0, lastT: 0, lastSeq: -1,
      });
    }
  });
  session.on('peerLeft', e => {
    if (e && typeof e.id === 'number') {
      game.remotes.delete(e.id);
    }
    // Host disconnect = session ends for joiners.
    if (e && e.wasHost) {
      try { session.close(); } catch {}
      game = createGame();
      game.state = 'title';
      if (typeof openMpModal === 'function') openMpModal();
      return;
    }
    // If spectating and no remotes left alive, end the run.
    if (game.spectating) {
      let anyAlive = false;
      for (const x of game.remotes.values()) { if (x.alive) { anyAlive = true; break; } }
      if (!anyAlive && game.state === 'playing') {
        game.state = 'gameover';
        game.spectating = false;
      }
    }
  });
  session.on('kicked', () => {
    try { session.close(); } catch {}
    game = createGame();
    game.state = 'title';
    if (typeof setMpStatus === 'function') setMpStatus('You were removed from the room');
    if (typeof openMpModal === 'function') openMpModal();
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
