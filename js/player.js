// Player state. Position is in world units; the camera follows on Y.

export function createPlayer() {
  return {
    x: 0,             // horizontal in world units, 0 = center
    y: 0,             // vertical, increases as you ski down
    state: 'straight',
    crashTimer: 0,    // seconds remaining of crash recovery
    width: 18,
    height: 28,
  };
}

const TURN_SPEED_X = {
  straight: 0,
  leftEasy: -90,
  leftHard: -160,
  rightEasy: 90,
  rightHard: 160,
};

const FORWARD_SPEED = {
  straight: 220,
  leftEasy: 180,
  leftHard: 110,
  rightEasy: 180,
  rightHard: 110,
};

export function updatePlayer(player, input, dt, speedMult = 1) {
  if (player.crashTimer > 0) {
    player.crashTimer -= dt;
    player.state = 'crashed';
    if (player.crashTimer <= 0) {
      player.state = 'straight';
    }
    return 0; // no forward progress while crashed
  }

  // Determine state from input.
  if (input.down) {
    player.state = 'straight';
  } else if (input.left && input.right) {
    player.state = 'straight';
  } else if (input.left) {
    player.state = player.state === 'leftEasy' || player.state === 'leftHard'
      ? 'leftHard' : 'leftEasy';
  } else if (input.right) {
    player.state = player.state === 'rightEasy' || player.state === 'rightHard'
      ? 'rightHard' : 'rightEasy';
  } else {
    // No input - drift in current direction but ease toward straight.
    if (player.state === 'leftHard') player.state = 'leftEasy';
    else if (player.state === 'rightHard') player.state = 'rightEasy';
  }

  const vx = TURN_SPEED_X[player.state] || 0;
  const vy = (FORWARD_SPEED[player.state] || 200) * speedMult;

  player.x += vx * dt;
  player.y += vy * dt;
  return vy * dt;
}

export function crashPlayer(player) {
  player.crashTimer = 1.5;
  player.state = 'crashed';
}
