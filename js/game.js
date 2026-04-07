import { createPlayer, updatePlayer, crashPlayer, launchJump, isAirborne } from './player.js';
import { createWorld, updateWorld, checkCollisions } from './world.js';
import { createYeti, updateYeti, resetYeti } from './yeti.js';
import { fetchLeaderboard, submitScore, getStoredName } from './leaderboard.js';

const HIGH_SCORE_KEY = 'skifree.highScore';

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

export function createGame() {
  return {
    state: 'title', // 'title' | 'playing' | 'gameover'
    player: createPlayer(),
    world: createWorld(),
    yeti: createYeti(),
    score: 0,
    startY: 0,
    elapsed: 0,
    highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
    controlHint: 'press any key or tap to start',
    hint: pickHint(),
    leaderboard: null,        // array of {name, score, created_at} or null
    leaderboardLoading: false,
  };
}

export function loadLeaderboard(game) {
  game.leaderboardLoading = true;
  fetchLeaderboard().then(scores => {
    game.leaderboardLoading = false;
    if (scores) game.leaderboard = scores;
  });
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

  if (game.state === 'playing') {
    game.elapsed += dt;
    // Difficulty: 1.0 at start, +1.0 per 30s, capped at ~3.5.
    const difficulty = Math.min(3.5, 1 + game.elapsed / 30);
    const speedMult = Math.min(1.6, 1 + game.elapsed / 90);

    updatePlayer(game.player, input, dt, speedMult);
    updateWorld(game.world, game.player, viewport, difficulty);

    const hit = checkCollisions(game.world, game.player);
    if (hit) {
      if (hit.type.kind === 'jump') {
        launchJump(game.player);
      } else if (hit.type.deadly && !isAirborne(game.player) && game.player.crashTimer <= 0) {
        crashPlayer(game.player);
        endRun(game);
        return;
      }
    }

    const eaten = updateYeti(game.yeti, game.player, dt, difficulty);
    if (eaten) {
      endRun(game);
      return;
    }

    game.score = Math.max(0, (game.player.y - game.startY) / 10);
    if (game.score > game.highScore) {
      game.highScore = game.score;
    }
    return;
  }

  if (game.state === 'gameover') {
    if (input.restart) {
      startRun(game);
    }
    return;
  }
}

function startRun(game) {
  game.player = createPlayer();
  game.world = createWorld();
  resetYeti(game.yeti);
  game.score = 0;
  game.startY = 0;
  game.elapsed = 0;
  game.state = 'playing';
}

export function forceEndRun(game) {
  if (game.state === 'playing') endRun(game);
}

function endRun(game) {
  game.state = 'gameover';
  game.hint = pickHint();
  localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));

  const finalScore = Math.floor(game.score);
  const name = getStoredName().trim() || 'anon';
  if (finalScore > 0) {
    game.leaderboardLoading = true;
    submitScore(name, finalScore).then(scores => {
      game.leaderboardLoading = false;
      if (scores) game.leaderboard = scores;
    });
  }
}
