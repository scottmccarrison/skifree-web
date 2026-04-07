import { createPlayer, updatePlayer, crashPlayer } from './player.js';
import { createWorld, updateWorld, checkCollisions } from './world.js';
import { createYeti, updateYeti, resetYeti } from './yeti.js';

const HIGH_SCORE_KEY = 'skifree.highScore';

export function createGame() {
  return {
    state: 'title', // 'title' | 'playing' | 'gameover'
    player: createPlayer(),
    world: createWorld(),
    yeti: createYeti(),
    score: 0,
    startY: 0,
    highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
    controlHint: 'press any key or tap to start',
  };
}

export function updateGame(game, input, viewport, dt) {
  // Refresh control hint based on detected mode.
  game.controlHint = input.mode === 'touch'
    ? 'tap ◀ ▼ ▶ to ski - tap to start'
    : 'arrows to steer, down to dive - space to start';

  if (game.state === 'title') {
    if (input.restart || input.left || input.right || input.down) {
      startRun(game);
    }
    return;
  }

  if (game.state === 'playing') {
    updatePlayer(game.player, input, dt);
    updateWorld(game.world, game.player, viewport);

    const hit = checkCollisions(game.world, game.player);
    if (hit && hit.type.deadly && game.player.crashTimer <= 0) {
      crashPlayer(game.player);
    }

    const eaten = updateYeti(game.yeti, game.player, dt);
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
    if (input.restart || input.left || input.right || input.down) {
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
  game.state = 'playing';
}

function endRun(game) {
  game.state = 'gameover';
  localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(game.highScore)));
}
