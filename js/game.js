import { createPlayer, updatePlayer, crashPlayer, launchJump, launchHop, isAirborne } from './player.js';
import { createWorld, updateWorld, checkCollisions } from './world.js';
import { createYeti, updateYeti, resetYeti, checkYetiCollision } from './yeti.js';
import { fetchLeaderboard, submitScore, getStoredName, recordPersonalBest, getPersonalBests } from './leaderboard.js';
import { captureCrashSnapshot } from './diagnostics.js';

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

export function createGame(seed) {
  const gameSeed = (seed === undefined ? Date.now() : seed) >>> 0;
  return {
    state: 'title', // 'title' | 'playing' | 'paused' | 'gameover'
    seed: gameSeed,
    player: createPlayer(),
    world: createWorld(gameSeed),
    yeti: createYeti(gameSeed),
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
    rematchPending: false,
    rematchStatus: '',
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
    // Single source of truth for the camera/world target. render.js reads
    // this so it never disagrees with what world generation is following.
    game.cameraTarget = game.spectating ? pickSpectateTarget(game) : game.player;
    updateWorld(game.world, game.cameraTarget, viewport, difficulty);

    const hit = checkCollisions(game.world, game.player);
    if (hit) {
      if (hit.type.kind === 'jump') {
        launchJump(game.player);
      } else if (hit.type.kind === 'mogul') {
        if (!hit.hopped && !isAirborne(game.player)) {
          hit.hopped = true;
          launchHop(game.player);
        }
      } else if (hit.type.deadly && !isAirborne(game.player) && game.player.crashTimer <= 0 && !game.spectating) {
        captureCrashSnapshot(game);
        crashPlayer(game.player);
        endRun(game);
        return;
      }
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
        endRun(game);
        return;
      }
      // If the yeti caught a remote, that remote's client detects it via
      // its own checkYetiCollision against the broadcast yeti position.
    } else {
      // Non-host MP: yeti position is driven by network messages.
      // Still run an identical collision check locally so deaths are responsive.
      if (!game.spectating && checkYetiCollision(game.yeti, game.player)) {
        crashPlayer(game.player);
        endRun(game);
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

// Builds the cycle order: all remotes (id order) + local player at the end.
// Includes crashed players per spec.
export function getSpectateCycle(game) {
  const order = [];
  if (game.remotes) {
    const sorted = Array.from(game.remotes.values()).sort((a, b) => a.id - b.id);
    for (const r of sorted) order.push(r);
  }
  order.push(game.player);
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
  game.score = 0;
  game.startY = 0;
  game.elapsed = 0;
  game.state = 'playing';
}

export function forceEndRun(game) {
  if (game.state === 'playing' || game.state === 'paused') endRun(game);
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

function endRun(game) {
  if (game.spectating) return;
  if (game.state === 'gameover') return;
  // MP: notify peer of our death once, regardless of which branch we take.
  if (game.mode === 'mp' && game.session && !game.diedSent) {
    try { game.session.sendDied(); } catch {}
    game.diedSent = true;
  }
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
  game.deathCount += 1;
  localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));
  localStorage.setItem(DEATH_COUNT_KEY, String(game.deathCount));

  // Leaderboard submission is suppressed entirely in multiplayer.
  if (game.mode === 'mp') return;

  const finalScore = Math.floor(game.score);
  const name = getStoredName().trim() || 'anon';
  game.personalBests = recordPersonalBest(finalScore);
  if (finalScore > 0) {
    game.leaderboardLoading = true;
    submitScore(name, finalScore).then(board => {
      game.leaderboardLoading = false;
      if (board) game.leaderboard = board;
    });
  }
}
