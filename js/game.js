import { createPlayer, updatePlayer, crashPlayer, launchJump, isAirborne } from './player.js';
import { createWorld, updateWorld, checkCollisions } from './world.js';
import { createYeti, updateYeti, resetYeti } from './yeti.js';
import { fetchLeaderboard, submitScore, getStoredName } from './leaderboard.js';

const HIGH_SCORE_KEY = 'skifree.highScore';

const HINTS = [
  'jump over logs for a speed boost',
  'jumping makes you invincible mid-air',
  'sharp turns slow you down - the yeti loves that',
  'the yeti shows up around 50 seconds in',
  'going straight is your fastest steady pace',
  'moguls are bumpy but harmless',
  'every 1000m the snow gets a little darker',
  'past 5000m the world goes dark - good luck',
  'tap or click to start, space to restart',
  'on mobile, hold the arrows to keep turning',
  'jumps can save you from a tight tree cluster',
  'the yeti always finds you eventually',
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
