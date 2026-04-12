import { initInput, input } from './input.js';
import { createGame, updateGame, loadLeaderboard, forceEndRun, forceGameOver, setLeaderboardTab, advanceSpectateCycle, enqueueChatBubble, clearChatBubblesForPeer } from './game.js';
import { CHAT_PRESETS } from './chatPresets.js';
import { render, hitRegions } from './render.js';
import { getStoredName, setStoredName } from './leaderboard.js';
import { buildDiagnosticsMeta, logInput } from './diagnostics.js';
import { CHANGELOG, LATEST_VERSION } from './changelog.js';
import { createSession } from './net.js';
import { colorForIndex } from './colors.js';

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

// Track whether opening feedback paused an in-progress solo run, so we can
// resume it on close. MP never pauses - peers would desync from a frozen host.
// Cleared whenever the `game` variable gets reassigned (kick / host-leave /
// rematch / mp-cancel) so a stale flag never tries to mutate a fresh game.
let feedbackPausedRun = false;
function clearFeedbackPause() { feedbackPausedRun = false; }

function openFeedback() {
  if (game && game.mode !== 'mp' && game.state === 'playing') {
    game.state = 'paused';
    feedbackPausedRun = true;
  }
  // v0.4: count pauses for The Yetis Are Watching achievement. Solo only -
  // MP doesn't actually pause when feedback opens, so counting MP feedback
  // opens would falsely award the achievement to multiplayer players.
  if (game && game.run && game.mode !== 'mp') game.run.pauses += 1;
  fbStatus.textContent = '';
  fbText.value = '';
  fbSend.disabled = false;
  fbCancel.disabled = false;
  fbModal.classList.remove('hidden');
  setTimeout(() => fbText.focus(), 0);
}

function closeFeedback() {
  fbModal.classList.add('hidden');
  if (feedbackPausedRun && game && game.state === 'paused') {
    game.state = 'playing';
  }
  feedbackPausedRun = false;
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
    const seg = location.pathname.split('/')[1] || '';
    const apiBase = (seg === 'ski' || seg === 'skidev') ? `/${seg}/api` : '/api';
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
  if (game.state === 'playing' && game.spectating) {
    if (e.target && e.target.closest && e.target.closest('#top-right, #feedback-modal, #mp-modal, #changelog-modal, #title-button')) return;
    advanceSpectateCycle(game);
    e.stopPropagation();
    return;
  }
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
const titleBtnEl = document.getElementById('title-button');
const chatBarEl = document.getElementById('chat-bar');

// Mount preset buttons once. Click handlers gate on session + cooldown and
// optimistically self-echo so the sender sees their own bubble immediately.
let chatCooldownUntil = 0;
function mountChatBar() {
  if (!chatBarEl || chatBarEl.dataset.mounted === '1') return;
  chatBarEl.dataset.mounted = '1';
  for (const preset of CHAT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-btn';
    btn.title = preset.text;
    btn.textContent = preset.emoji;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = performance.now();
      if (now < chatCooldownUntil) return;
      if (!mpSession || mpSession.id == null) return;
      try { mpSession.sendChat(preset.id); } catch {}
      // Optimistic self-echo: render our own bubble immediately.
      enqueueChatBubble(game, mpSession.id, preset.id);
      chatCooldownUntil = now + 1000;
      // Grey out all buttons for 1s to mirror the worker rate limit.
      for (const b of chatBarEl.querySelectorAll('.chat-btn')) {
        b.disabled = true;
        b.style.opacity = '0.5';
      }
      setTimeout(() => {
        for (const b of chatBarEl.querySelectorAll('.chat-btn')) {
          b.disabled = false;
          b.style.opacity = '';
        }
      }, 1000);
    });
    chatBarEl.appendChild(btn);
  }
}
mountChatBar();

function isMpModalOpen() {
  const m = document.getElementById('mp-modal');
  return !!(m && !m.classList.contains('hidden'));
}

function shouldShowChatBar() {
  if (!game || game.mode !== 'mp') return false;
  if (!mpSession || mpSession.id == null) return false;
  return !!(game.spectating || isMpModalOpen() || game.state === 'gameover') && !isMpModalOpen();
}

function syncTouchZones() {
  if (!touchZonesEl) return;
  touchZonesEl.classList.toggle('disabled', game.state !== 'playing');
  // Hide the SKI FREE end-run button on title/gameover so it doesn't crash
  // into the initials input on narrow screens. It only does anything during
  // an active run anyway.
  if (titleBtnEl) {
    const showBtn = (game.state === 'playing' || game.state === 'paused');
    titleBtnEl.style.display = showBtn ? '' : 'none';
  }
  // Derive chat bar visibility per-frame. Handles peerLeft drop-to-solo,
  // host disconnect reset, reconnect, rematch lobby, pre-welcome gaps.
  if (chatBarEl) {
    const show = shouldShowChatBar();
    chatBarEl.hidden = !show;
    // Shrink the touch zones' bottom inset so the chat bar row doesn't
    // steal steering taps on mobile.
    touchZonesEl.classList.toggle('chat-inset', show);
  }
  const topRight = document.getElementById('top-right');
  if (topRight) topRight.classList.toggle('spectating-hidden', !!game.spectating);
}

// Multiplayer lobby modal wiring.
let mpSession = null;
let mpKickedFlag = false;
// Tracks whether the MP gameover modal has been shown for the current
// gameover transition. Reset when state leaves gameover.
let mpGameoverShown = false;

function renderLobby() {
  if (!mpSession) return;
  const roster = mpSession.roster || [];
  const myId = mpSession.id;
  const iAmHost = mpSession.isHost;
  const inGameover = !!(game && game.state === 'gameover' && game.mode === 'mp');

  document.getElementById('mp-roster-wrap').classList.remove('hidden');
  document.getElementById('mp-pre-join').classList.add('hidden');

  document.getElementById('mp-roster-count').textContent = `${roster.length}/10`;

  const list = document.getElementById('mp-roster');
  list.innerHTML = '';

  // Build a score lookup so the gameover view can show each player's score.
  const scoreFor = (id) => {
    if (id === myId) return Math.floor(game && game.score || 0);
    const r = game && game.remotes && game.remotes.get(id);
    return r ? Math.floor(r.score || 0) : 0;
  };

  for (const p of roster) {
    const row = document.createElement('div');
    row.className = 'mp-row' + (p.id === myId ? ' mp-row-self' : '');
    row.dataset.id = String(p.id);

    const sw = document.createElement('div');
    sw.className = 'mp-swatch';
    sw.style.background = colorForIndex(p.color);
    row.appendChild(sw);

    const nm = document.createElement('div');
    nm.className = 'mp-name';
    nm.textContent = p.name || `anon${p.id}`;
    if (p.isHost) {
      const tag = document.createElement('span');
      tag.className = 'mp-tag';
      tag.textContent = '(host)';
      nm.appendChild(tag);
    }
    row.appendChild(nm);

    // In gameover, show the player's final score before the ready check.
    if (inGameover) {
      const sc = document.createElement('div');
      sc.className = 'mp-score';
      sc.textContent = scoreFor(p.id) + ' m';
      row.appendChild(sc);
    }

    if (p.ready) {
      const rd = document.createElement('div');
      rd.className = 'mp-ready-icon';
      rd.textContent = '✓';
      row.appendChild(rd);
    }

    if (iAmHost && p.id !== myId && !p.isHost) {
      const k = document.createElement('button');
      k.className = 'mp-kick-btn';
      k.textContent = 'Kick';
      k.addEventListener('click', () => mpSession.sendKick(p.id));
      row.appendChild(k);
    }

    list.appendChild(row);
  }
}

// Open the MP modal in "rematch" state (roster + ready button visible),
// reusing the lobby DOM. Called when local game transitions to MP gameover.
function openMpRematchModal() {
  if (!mpSession) return;
  const modal = document.getElementById('mp-modal');
  modal.classList.remove('hidden');
  // Hide pre-join (host/join row), show roster + code
  document.getElementById('mp-pre-join').classList.add('hidden');
  document.getElementById('mp-roster-wrap').classList.remove('hidden');
  if (mpSession.code) {
    document.getElementById('mp-code-display').textContent = mpSession.code;
    document.getElementById('mp-code-row').classList.remove('hidden');
  }
  const ready = document.getElementById('mp-ready');
  ready.classList.remove('hidden');
  ready.style.display = '';
  ready.disabled = false;
  ready.textContent = 'Rematch';
  const cancel = document.getElementById('mp-cancel');
  if (cancel) cancel.disabled = false;
  setMpStatus('Press Rematch when ready');
  renderLobby();
}

function openMpModal() {
  const modal = document.getElementById('mp-modal');
  modal.classList.remove('hidden');
  document.getElementById('mp-roster-wrap').classList.add('hidden');
  document.getElementById('mp-pre-join').classList.remove('hidden');
  document.getElementById('mp-code-row').classList.add('hidden');
  document.getElementById('mp-code-display').textContent = '';
  const ready = document.getElementById('mp-ready');
  ready.classList.add('hidden');
  ready.disabled = true;
  ready.style.display = '';
  setMpStatus('');
  const codeInput = document.getElementById('mp-code-input');
  codeInput.value = '';
  codeInput.disabled = false;
  document.getElementById('mp-host').disabled = false;
  document.getElementById('mp-join-go').disabled = false;
  const cancel = document.getElementById('mp-cancel');
  if (cancel) cancel.disabled = false;
  const list = document.getElementById('mp-roster');
  if (list) list.innerHTML = '';
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

// Recompute the "X/Y ready" status string from the current roster.
// Used by peerReady and peerLeft so the displayed count never goes stale
// when peers ready up or disconnect. Safe to call when not in a lobby
// state - it just no-ops if there's nothing to count.
function refreshReadyStatus() {
  if (!mpSession) return;
  const r = mpSession.roster;
  if (!r || r.length === 0) return;
  if (r.length >= 2 && r.every(p => p.ready)) return; // 'start' will replace this
  const numReady = r.filter(p => p.ready).length;
  setMpStatus(`${numReady}/${r.length} ready`);
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
    setMpStatus('Waiting for players...');
    renderLobby();
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
    // Mid-run join: a game is already running in this room. Drop straight
    // into spectator mode instead of the lobby. We get added to the next
    // rematch automatically when everyone dies.
    if (mpSession.inProgress) {
      document.getElementById('mp-modal').classList.add('hidden');
      if (typeof window.startMultiplayerGame === 'function') {
        window.startMultiplayerGame(mpSession.seed, mpSession);
        // Mark our local player crashed + spectating so updateGame freezes
        // them and the camera follows the slowest alive remote.
        game.player.state = 'crashed';
        game.player.crashTimer = 999;
        game.spectating = true;
        game.diedSent = true;
        try { mpSession.sendDied(); } catch {}
      }
      return;
    }
    renderLobby();
    const ready = document.getElementById('mp-ready');
    ready.classList.remove('hidden');
    ready.disabled = (mpSession.roster.length < 2);
    if (mpSession.roster.length >= 2) {
      setMpStatus('Ready up when you are');
    } else {
      setMpStatus('Waiting for players...');
    }
  });
  mpSession.on('peerJoined', e => {
    renderLobby();
    const ready = document.getElementById('mp-ready');
    ready.classList.remove('hidden');
    ready.disabled = (mpSession.roster.length < 2);
    setMpStatus(`${e.name || 'A player'} joined`);
  });
  mpSession.on('peerReady', () => {
    // The visual checkmark in renderLobby IS the feedback - same in lobby
    // and in MP gameover (the modal is reused for both).
    renderLobby();
    refreshReadyStatus();
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
    renderLobby();
    const ready = document.getElementById('mp-ready');
    if (mpSession.roster.length < 2) {
      ready.disabled = true;
      setMpStatus('Waiting for players...');
    } else {
      // Recompute the "X/Y ready" string so the displayed denominator
      // matches the new roster size after a peer disconnects.
      refreshReadyStatus();
    }
  });
  mpSession.on('error', () => {
    setMpStatus('Could not join room');
    document.getElementById('mp-host').disabled = false;
    document.getElementById('mp-join-go').disabled = false;
    document.getElementById('mp-code-input').disabled = false;
  });
  mpSession.on('close', () => {
    if (mpKickedFlag) { mpKickedFlag = false; return; }
    if (!document.getElementById('mp-modal').classList.contains('hidden')) {
      setMpStatus('Disconnected');
    }
  });
}

document.getElementById('mp-host').addEventListener('click', startHost);
document.getElementById('mp-join-go').addEventListener('click', commitJoin);
document.getElementById('mp-ready').addEventListener('click', () => {
  if (!mpSession) return;
  // Only commit local UI state if the message actually went out. A silent
  // send failure (closed/connecting socket) used to leave the button
  // permanently disabled with no recourse - now we surface the error.
  const sent = mpSession.sendReady();
  if (!sent) {
    setMpStatus('Connection lost - try rejoining');
    return;
  }
  const numReady = (mpSession.roster.filter(p => p.ready).length) + 1;
  setMpStatus(`${numReady}/${mpSession.roster.length} ready (you're in)`);
  document.getElementById('mp-ready').disabled = true;
});
document.getElementById('mp-cancel').addEventListener('click', () => {
  // If we're cancelling out of MP gameover (rematch screen), fully drop
  // back to a fresh solo title - the game is otherwise stuck in 'gameover'
  // with no canvas controls (the panel is suppressed in MP gameover).
  const wasMpGameover = game && game.state === 'gameover' && game.mode === 'mp';
  closeMpModal();
  if (wasMpGameover) {
    game = createGame();
    game.state = 'title';
    mpGameoverShown = false;
    clearFeedbackPause();
  }
});
document.getElementById('mp-code-input').addEventListener('keydown', (e) => e.stopPropagation());

// Mobile Safari aggressively kills WebSockets when the tab backgrounds. On
// return, if we still think we have an MP session but the socket is dead,
// transparently rejoin the same room. The user comes back as a spectator
// (server already saw them leave), which is much better than losing the
// session entirely.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!mpSession) return;
  if (!mpSession.closed) return;
  const code = mpSession.code;
  if (!code) return;
  // Recreate the session targeting the same room. wireMpSession's welcome
  // handler will detect inProgress and drop straight into spectator mode.
  mpSession = createSession();
  wireMpSession();
  setMpStatus('Reconnecting...');
  mpSession.join(code);
});

// Bridge from the lobby (WS3) into actual gameplay (WS4). Replaces the
// current game object with a fresh seeded one, attaches the live session,
// and wires gameplay-specific listeners onto it.
window.startMultiplayerGame = function(seed, session) {
  clearFeedbackPause();
  clearCosmeticPause();
  game = createGame(seed >>> 0);
  game.mode = 'mp';
  game.session = session;
  game.isHost = !!session.isHost;
  game.localColor = session.color;
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
      speedMult: 1,

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

  session.on('chat', ({ from, presetId }) => {
    enqueueChatBubble(game, from, presetId);
  });

  session.on('state', e => {
    if (typeof e.id !== 'number') return;
    let r = game.remotes.get(e.id);
    if (!r) {
      const meta = (session.roster || []).find(p => p.id === e.id) || {};
      r = {
        id: e.id, name: meta.name || `anon${e.id}`, color: meta.color || 0,
        x: 0, y: 0, state: 'straight', score: 0, speedMult: 1, alive: true,
        prevX: 0, prevY: 0, prevT: 0, lastT: 0, lastSeq: -1,
      };
      game.remotes.set(e.id, r);
    }
    if (typeof e.seq === 'number' && e.seq < r.lastSeq) return;
    if (typeof e.seq === 'number') r.lastSeq = e.seq;
    // Validate position fields - a malformed peer message must not poison
    // the remote's lerp/render state.
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
    r.prevX = r.x;
    r.prevY = r.y;
    r.prevT = r.lastT || (performance.now() / 1000);
    r.x = e.x;
    r.y = e.y;
    if (e.state) r.state = e.state;
    if (typeof e.score === 'number') r.score = e.score;
    if (typeof e.speedMult === 'number') r.speedMult = e.speedMult;
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
        x: 0, y: 0, state: 'straight', score: 0, speedMult: 1, alive: true,
        prevX: 0, prevY: 0, prevT: 0, lastT: 0, lastSeq: -1,
      });
    }
  });
  session.on('peerLeft', e => {
    if (e && typeof e.id === 'number') {
      game.remotes.delete(e.id);
      clearChatBubblesForPeer(game, e.id);
    }
    // Host disconnect = session ends for joiners.
    if (e && e.wasHost) {
      try { session.close(); } catch {}
      game = createGame();
      game.state = 'title';
      clearFeedbackPause();
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
    mpKickedFlag = true;
    try { session.close(); } catch {}
    game = createGame();
    game.state = 'title';
    clearFeedbackPause();
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

  // MP gameover: open the lobby-style rematch modal once per gameover.
  // Reset the guard whenever we leave gameover so the next death re-opens it.
  if (game.state === 'gameover' && game.mode === 'mp' && mpSession && !mpGameoverShown) {
    mpGameoverShown = true;
    openMpRematchModal();
  } else if (game.state !== 'gameover' && mpGameoverShown) {
    mpGameoverShown = false;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
