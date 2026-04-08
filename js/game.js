import { createPlayer, updatePlayer, crashPlayer, launchJump, launchHop, isAirborne } from './player.js';
import { createWorld, updateWorld, checkCollisions } from './world.js';
import { createYeti, updateYeti, resetYeti, checkYetiCollision } from './yeti.js';
import { createCritters, resetCritters, updateCritters, checkCritterCollision } from './critters.js';
import { fetchLeaderboard, submitScore, getStoredName, recordPersonalBest, getPersonalBests } from './leaderboard.js';
import { captureCrashSnapshot } from './diagnostics.js';
import { loadProfile, bumpStartRun, recordRunResult } from './profile.js';
import { checkAchievements } from './achievements.js';

const HIGH_SCORE_KEY = 'skifree.highScore';
const DEATH_COUNT_KEY = 'skifree.deathCount';

const HINTS = [
  // What to avoid
  'trees, rocks, and stumps end the run instantly',
  'moguls are just bumps - ski right over them',
  'tight tree clusters are a trap, look for gaps early',

  // Yeti
  'a yeti starts hunting you around 50 seconds in',
  'the yeti is faster when you turn - stay straight to escape',
  'no one outruns the yeti forever, only delays it',

  // Speed
  'hit a log to launch into the air with a speed burst',
  'going straight is your top steady speed',
  'mid-air you are invincible - jump through danger',

  // Controls
  'release left and right to drift back to straight',
  'on mobile, tap the left or right half of the screen',
  'hold a side to keep turning, let go to recover',

  // Progression
  'every 1000m the snow grows a little darker',
  'past 5000m the whole world flips - good luck out there',

  // Meta
  'if the screen zooms by accident, just reload',
  'your name in the corner is what shows on the leaderboard',
];

function pickHint() {
  return HINTS[Math.floor(Math.random() * HINTS.length)];
}

// Per-run achievement counters. Reset by startRun.
function createRun() {
  return {
    jumps: 0,
    hops: 0,
    pauses: 0,
    turnedEver: false,
    yetiVisibleSeconds: 0,
    maxAbsX: 0,
  };
}

export function createGame(seed) {
  const gameSeed = (seed === undefined ? Date.now() : seed) >>> 0;
  return {
    state: 'title', // 'title' | 'playing' | 'paused' | 'gameover'
    seed: gameSeed,
    player: createPlayer(),
    world: createWorld(gameSeed),
    yeti: createYeti(gameSeed),
    critters: createCritters(),
    score: 0,
    startY: 0,
    elapsed: 0,
    highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
    deathCount: Number(localStorage.getItem(DEATH_COUNT_KEY) || 0),
    controlHint: 'press any key or tap to start',
    hint: pickHint(),
    leaderboard: null,        // normalized board: {daily, alltime, topEver, resetsAt, serverNow} or null
    leaderboardLoading: false,
    leaderboardTab: 'daily',  // 'daily' | 'alltime' | 'you'
    personalBests: getPersonalBests(),
    // Multiplayer (defaults are solo-safe)
    mode: 'solo',          // 'solo' | 'mp'
    session: null,
    isHost: true,
    remotes: new Map(),
    remoteYeti: null,
    spectateCycleIdx: 0,
    spectating: false,
    lastSentT: 0,
    seq: 0,
    peerLeft: false,
    diedSent: false,
    scoreSubmitted: false,
    rematchPending: false,
    rematchStatus: '',
    // v0.4: cosmetics + achievements. Profile is the persistent player record.
    profile: loadProfile(),
    run: createRun(),
    toasts: { active: null, queue: [] },  // FIFO toast queue, one visible at a time
    // Spectator chat bubbles: one-per-peer, replace on new message.
    // Shape: [{ peerId, presetId, expiresAt }]
    chatBubbles: [],
    // Per-frame map of peerId -> { x, y, rowH } stashed by the roster draw
    // so chat bubbles can anchor to roster rows instead of world coords.
    _rosterRowPositions: new Map(),
  };
}

export function loadLeaderboard(game) {
  game.leaderboardLoading = true;
  fetchLeaderboard().then(board => {
    game.leaderboardLoading = false;
    if (board) game.leaderboard = board;
  });
}

export function setLeaderboardTab(game, tab) {
  if (tab === 'daily' || tab === 'alltime' || tab === 'you') {
    game.leaderboardTab = tab;
  }
}

export function updateGame(game, input, viewport, dt) {
  // Refresh control hint based on detected mode.
  game.controlHint = input.mode === 'touch'
    ? 'tap ◀ ▼ ▶ to ski - tap to start'
    : 'left/right to steer - space to start';

  // Tick the toast queue. Strict FIFO: one visible at a time, advance when
  // the active toast expires. Runs in every state so toasts can finish
  // playing on the gameover screen.
  tickToasts(game);
  tickChatBubbles(game);

  if (game.state === 'title') {
    if (input.restart || input.left || input.right || input.down) {
      startRun(game);
    }
    return;
  }

  // Paused (e.g. feedback modal open in solo). Freeze the sim entirely.
  // MP never pauses - openFeedback gates on game.mode !== 'mp'.
  if (game.state === 'paused') {
    return;
  }

  if (game.state === 'playing') {
    game.elapsed += dt;
    // Difficulty: 1.0 at start, +1.0 per 30s, capped at ~3.5.
    const difficulty = Math.min(3.5, 1 + game.elapsed / 30);
    const speedMult = Math.min(1.6, 1 + game.elapsed / 90);
    // Exposed on game so the MP broadcast payload can include it - the host
    // needs every player's speedMult to scale the yeti against its target.
    game.speedMult = speedMult;

    if (!game.spectating) {
      updatePlayer(game.player, input, dt, speedMult);
    }

    // Achievement counters - cheap per-frame state tracking.
    if (input.left || input.right) game.run.turnedEver = true;
    const absX = Math.abs(game.player.x);
    if (absX > game.run.maxAbsX) game.run.maxAbsX = absX;
    if (game.yeti.active && isYetiOnScreen(game, viewport)) {
      game.run.yetiVisibleSeconds += dt;
    }
    // Frame-phase achievements (score milestones, single-run counters).
    enqueueAchievementToasts(game, checkAchievements('frame', game, game.profile));

    // Single source of truth for the camera/world target. render.js reads
    // this so it never disagrees with what world generation is following.
    game.cameraTarget = game.spectating ? pickSpectateTarget(game) : game.player;
    // Smoothed camera position - exponential lerp toward target so the
    // transition into spectator mode (and switches between remotes) glides
    // instead of teleporting. Initialised to the target on first frame.
    if (!game.cameraPos) {
      game.cameraPos = { x: game.cameraTarget.x, y: game.cameraTarget.y };
    } else {
      // dt-aware exponential smoothing. k=12 -> ~150ms to settle.
      const k = game.spectating ? 6 : 24;  // softer when spectating
      const a = 1 - Math.exp(-k * dt);
      game.cameraPos.x += (game.cameraTarget.x - game.cameraPos.x) * a;
      game.cameraPos.y += (game.cameraTarget.y - game.cameraPos.y) * a;
    }
    updateWorld(game.world, game.cameraTarget, viewport, difficulty);

    const hit = checkCollisions(game.world, game.player);
    if (hit) {
      if (hit.type.kind === 'jump') {
        launchJump(game.player);
        if (!hit.counted) { hit.counted = true; game.run.jumps += 1; }
      } else if (hit.type.kind === 'mogul') {
        if (!hit.hopped && !isAirborne(game.player)) {
          hit.hopped = true;
          launchHop(game.player);
          game.run.hops += 1;
        }
      } else if (hit.type.deadly && !isAirborne(game.player) && game.player.crashTimer <= 0 && !game.spectating) {
        captureCrashSnapshot(game);
        crashPlayer(game.player);
        endRun(game, hit.type.kind);  // 'treeLarge'|'treeSmall'|'rock'|'stump'
        return;
      }
    }

    // Critters: per-player local hazards. Skip entirely while spectating -
    // a dead player can't crash again and the camera follows the slowest
    // alive remote, so spawning around our crashed body is wasted work.
    if (!game.spectating) {
      updateCritters(game.critters, game.player, viewport, dt, game.score, speedMult);
    }
    if (!game.spectating && checkCritterCollision(game.critters, game.player)) {
      captureCrashSnapshot(game);
      crashPlayer(game.player);
      endRun(game, 'squirrel');
      return;
    }

    if (game.mode !== 'mp' || game.isHost) {
      // Host (or solo): yeti chases slowest alive player
      const target = (game.mode === 'mp')
        ? (pickSlowestAlive(game) || game.player)
        : game.player;
      // updateYeti only reads target.x/target.y, but pass a safe shape.
      const targetForYeti = (target === game.player)
        ? game.player
        : { x: target.x, y: target.y };
      // Yeti speed scales with the target's own speedMult so it stays
      // proportional to whoever it's actually chasing.
      const targetSpeedMult = (target === game.player)
        ? speedMult
        : (typeof target.speedMult === 'number' ? target.speedMult : 1);
      const eaten = updateYeti(game.yeti, targetForYeti, dt, difficulty, targetSpeedMult);
      if (eaten && !game.spectating && target === game.player) {
        endRun(game, 'yeti');
        return;
      }
      // If the yeti caught a remote, that remote's client detects it via
      // its own checkYetiCollision against the broadcast yeti position.
    } else {
      // Non-host MP: yeti position is driven by network messages.
      // Still run an identical collision check locally so deaths are responsive.
      if (!game.spectating && checkYetiCollision(game.yeti, game.player)) {
        crashPlayer(game.player);
        endRun(game, 'yeti');
        return;
      }
    }

    // 10Hz state broadcast (host and joiner both send their own player state).
    if (game.mode === 'mp' && game.session && !game.peerLeft) {
      game.lastSentT += dt;
      if (game.lastSentT >= 0.1) {
        game.lastSentT = 0;
        const payload = {
          x: game.player.x,
          y: game.player.y,
          state: game.player.state,
          score: game.score,
          speedMult: game.speedMult,
          // v0.4 phase 2: broadcast equipped cosmetic so peers render it
          // on this player's tinted skier. Null = nothing equipped.
          equipped: game.profile?.equipped || null,
          seq: game.seq++,
        };
        if (game.isHost) {
          payload.yeti = {
            active: game.yeti.active,
            x: game.yeti.x,
            y: game.yeti.y,
          };
        }
        game.session.sendState(payload);
      }
    }

    game.score = Math.max(0, (game.player.y - game.startY) / 10);
    if (game.score > game.highScore) {
      game.highScore = game.score;
    }
    return;
  }

  if (game.state === 'gameover') {
    if (input.restart) {
      if (game.mode === 'mp' && game.session && !game.peerLeft && !game.rematchPending) {
        game.rematchPending = true;
        game.rematchStatus = "You're ready - waiting on friend...";
        try { game.session.sendReady(); } catch {}
      } else if (game.mode !== 'mp') {
        resetMpState(game);
        startRun(game);
      }
    }
    return;
  }
}

// Returns the alive player with the LOWEST y (slowest = least progress).
// Considers local game.player and all alive remotes.
// Returns null if everyone is dead.
export function pickSlowestAlive(game) {
  let slowest = null;
  if (!game.spectating && game.player.state !== 'crashed') {
    slowest = game.player;
  }
  if (game.remotes) {
    for (const r of game.remotes.values()) {
      if (!r.alive) continue;
      if (!r.lastT || r.lastT === 0) continue;  // Skip uninitialized remotes
      if (!slowest || r.y < slowest.y) slowest = r;
    }
  }
  return slowest;
}

// Builds the cycle order: alive remotes (id order) + local player if alive.
// Crashed players are excluded - their world is empty (obstacles only spawn
// around the active camera target) so spectating one shows a white screen.
export function getSpectateCycle(game) {
  const order = [];
  if (game.remotes) {
    const sorted = Array.from(game.remotes.values()).sort((a, b) => a.id - b.id);
    for (const r of sorted) {
      if (!r.alive) continue;
      order.push(r);
    }
  }
  // Local player is only worth including when alive (and not spectating).
  if (!game.spectating && game.player.state !== 'crashed') {
    order.push(game.player);
  }
  return order;
}

export function advanceSpectateCycle(game) {
  const cycle = getSpectateCycle(game);
  if (cycle.length === 0) return;
  game.spectateCycleIdx = (game.spectateCycleIdx + 1) % cycle.length;
}

export function pickSpectateTarget(game) {
  const cycle = getSpectateCycle(game);
  if (cycle.length === 0) return game.player;
  const idx = ((game.spectateCycleIdx % cycle.length) + cycle.length) % cycle.length;
  return cycle[idx];
}

function resetMpState(game) {
  if (game.mode === 'mp') {
    if (game.session && !game.session.closed) {
      try { game.session.close(); } catch {}
    }
    game.mode = 'solo';
    game.session = null;
    game.isHost = true;
    game.remotes = new Map();
    game.remoteYeti = null;
    game.spectateCycleIdx = 0;
    game.spectating = false;
    game.peerLeft = false;
    game.lastSentT = 0;
    game.seq = 0;
    game.diedSent = false;
  }
}

function startRun(game) {
  game.player = createPlayer();
  game.world = createWorld(game.seed);
  resetYeti(game.yeti);
  resetCritters(game.critters);
  game.scoreSubmitted = false;
  game.cameraPos = null;  // re-snap to player on first frame
  game.score = 0;
  game.startY = 0;
  game.elapsed = 0;
  game.state = 'playing';
  // v0.4: reset per-run counters and bump profile.
  game.run = createRun();
  bumpStartRun(game.profile);
  enqueueAchievementToasts(game, checkAchievements('startRun', game, game.profile));
}

export function forceEndRun(game) {
  if (game.state === 'playing' || game.state === 'paused') endRun(game, 'forced');
}

export function forceGameOver(game) {
  if (game.state === 'gameover') return;
  game.state = 'gameover';
  game.spectating = false;
  game.hint = pickHint();
  game.deathCount += 1;
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));
    localStorage.setItem(DEATH_COUNT_KEY, String(game.deathCount));
  } catch {}
}

// Persist death count + high score, record personal best, and submit to the
// leaderboard. Idempotent via game.scoreSubmitted so both the spectator
// branch and the final-gameover branch can call it safely. Used by solo
// AND multiplayer - MP scores now post to the same daily/all-time boards.
function finalizeScore(game) {
  if (game.scoreSubmitted) return;
  game.scoreSubmitted = true;
  game.deathCount += 1;
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));
    localStorage.setItem(DEATH_COUNT_KEY, String(game.deathCount));
  } catch {}
  const finalScore = Math.floor(game.score);
  const name = getStoredName().trim() || 'anon';
  // Record into the persistent profile so Hot Streak / Comeback Kid /
  // Touch Grass have something to look at on the next run.
  recordRunResult(game.profile, finalScore, game.highScore);
  game.personalBests = recordPersonalBest(finalScore);
  if (finalScore > 0) {
    game.leaderboardLoading = true;
    submitScore(name, finalScore).then(board => {
      game.leaderboardLoading = false;
      if (board) game.leaderboard = board;
      // Check leaderboard-phase achievements once the server response lands.
      enqueueAchievementToasts(game, checkAchievements('leaderboard', game, game.profile, {
        daily: board?.daily || [],
        alltime: board?.alltime || [],
        myName: name,
      }));
    });
  }
}

function endRun(game, causeOfDeath = 'unknown') {
  if (game.spectating) return;
  if (game.state === 'gameover') return;
  // Fire end-run achievements (Roadkill, Yeti Snack, baby_steps, etc.) BEFORE
  // the spectator branch so MP-spectator deaths still earn the unlock.
  enqueueAchievementToasts(game, checkAchievements('endRun', game, game.profile, { causeOfDeath }));
  // MP: notify peer of our death once, regardless of which branch we take.
  if (game.mode === 'mp' && game.session && !game.diedSent) {
    try { game.session.sendDied(); } catch {}
    game.diedSent = true;
  }
  // Submit immediately on local death so the player gets credit even if
  // they later spectate the rest of the lobby. finalizeScore is idempotent.
  finalizeScore(game);
  // Multiplayer: if the peer is still alive, become a spectator instead of
  // ending the run.
  if (game.mode === 'mp' && game.session && !game.peerLeft) {
    let anyAlive = false;
    for (const r of game.remotes.values()) { if (r.alive) { anyAlive = true; break; } }
    if (anyAlive) {
      game.spectating = true;
      // Auto-target yeti's prey (slowest alive) on first activation.
      const slowest = pickSlowestAlive(game);
      if (slowest && slowest !== game.player) {
        const cycle = getSpectateCycle(game);
        const idx = cycle.indexOf(slowest);
        if (idx >= 0) game.spectateCycleIdx = idx;
      }
      return;
    }
  }

  game.state = 'gameover';
  game.hint = pickHint();
}

// ---- v0.4 toast & achievement helpers ----

const TOAST_DURATION_MS = 2500;

// Advance the toast queue. Pops the active toast when it expires and pulls
// the next one from the queue. Strict FIFO, one visible at a time.
function tickToasts(game) {
  if (!game.toasts) return;
  const now = performance.now();
  if (game.toasts.active && now - game.toasts.active.startedAt > TOAST_DURATION_MS) {
    game.toasts.active = null;
  }
  if (!game.toasts.active && game.toasts.queue.length > 0) {
    const next = game.toasts.queue.shift();
    game.toasts.active = { ...next, startedAt: now };
  }
}

// Push newly-unlocked achievements onto the toast queue. checkAchievements
// returns an array of {achievement, cosmeticId}; we copy the bits we need
// for rendering (name + cosmetic id) so the toast is self-contained.
function enqueueAchievementToasts(game, newly) {
  if (!newly || newly.length === 0) return;
  for (const { achievement, cosmeticId } of newly) {
    game.toasts.queue.push({
      name: achievement.name,
      cosmeticId,
    });
  }
}

// ---- Spectator chat bubbles ----

const CHAT_BUBBLE_MS = 3500;

// Queue a chat bubble for a peer (or the local player via self-echo).
// Dedupes per peer: a new bubble replaces any existing one for the same peer.
export function enqueueChatBubble(game, peerId, presetId) {
  if (peerId == null) return;
  if (!game.chatBubbles) game.chatBubbles = [];
  const now = performance.now();
  game.chatBubbles = game.chatBubbles.filter(b => b.peerId !== peerId);
  game.chatBubbles.push({ peerId, presetId, expiresAt: now + CHAT_BUBBLE_MS });
}

// Drop expired bubbles, and bubbles whose peer has disconnected (so a stale
// bubble can't render at NaN coords after peerLeft wipes the remote).
function tickChatBubbles(game) {
  if (!game.chatBubbles || game.chatBubbles.length === 0) return;
  const now = performance.now();
  const localId = game.session ? game.session.id : null;
  game.chatBubbles = game.chatBubbles.filter(b => {
    if (b.expiresAt <= now) return false;
    if (localId != null && b.peerId === localId) return true;
    if (!game.remotes) return false;
    return game.remotes.has
      ? game.remotes.has(b.peerId)
      : !!game.remotes[b.peerId];
  });
}

// Clear any bubbles tied to a peer that just left. Belt-and-suspenders on
// top of tickChatBubbles' filter.
export function clearChatBubblesForPeer(game, peerId) {
  if (!game.chatBubbles) return;
  game.chatBubbles = game.chatBubbles.filter(b => b.peerId !== peerId);
}

// Yeti Survivor needs to know if the yeti is currently visible to the
// player. Approximate by checking if the yeti's world coords fall inside
// the camera viewport (with a small margin matching the sprite size).
function isYetiOnScreen(game, viewport) {
  const cam = game.cameraPos || game.cameraTarget || game.player;
  const camX = cam.x - viewport.w / 2;
  const camY = cam.y - viewport.h / 3;
  const sx = game.yeti.x - camX;
  const sy = game.yeti.y - camY;
  return sx >= -30 && sx <= viewport.w + 30 && sy >= -30 && sy <= viewport.h + 30;
}
