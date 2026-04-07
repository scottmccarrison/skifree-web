// Player state. Position is in world units; the camera follows on Y.

export function createPlayer() {
  return {
    x: 0,             // horizontal in world units, 0 = center
    y: 0,             // vertical, increases as you ski down
    state: 'straight',
    crashTimer: 0,    // seconds remaining of crash recovery
    airTime: 0,       // seconds remaining of jump (invulnerable; boosted only if !hopping)
    hopping: false,   // true when airborne from a mogul (no speed boost)
    idleTime: 0,      // seconds since last left/right input
    // Tight hit box centered on the skis' contact patch (not the whole body),
    // expressed as offsets from (x, y) and full width/height.
    hit: { dx: 0, dy: 8, w: 14, h: 10 },
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

const JUMP_DURATION = 0.7;
const JUMP_SPEED_MULT = 1.45;
const HOP_DURATION = 0.28;

export function launchJump(player) {
  if (player.airTime <= 0) {
    player.airTime = JUMP_DURATION;
    player.hopping = false;
  }
}

// Smaller hop for moguls: brief lift + invuln window, no speed boost.
export function launchHop(player) {
  if (player.airTime <= 0) {
    player.airTime = HOP_DURATION;
    player.hopping = true;
  }
}

export function isAirborne(player) {
  return player.airTime > 0;
}

export function updatePlayer(player, input, dt, speedMult = 1) {
  if (player.crashTimer > 0) {
    player.crashTimer -= dt;
    player.state = 'crashed';
    if (player.crashTimer <= 0) {
      player.state = 'straight';
    }
    return 0; // no forward progress while crashed
  }

  // Determine state from input. Auto-settle to straight after a brief idle.
  const turning = input.left || input.right;
  if (turning) player.idleTime = 0;
  else player.idleTime += dt;

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
  } else if (player.idleTime > 0.15) {
    // No turning input for a beat - drift back to straight.
    player.state = 'straight';
  } else {
    // Brief grace period: ease hard turns down to easy first.
    if (player.state === 'leftHard') player.state = 'leftEasy';
    else if (player.state === 'rightHard') player.state = 'rightEasy';
  }

  // Tick airborne timer.
  if (player.airTime > 0) {
    player.airTime = Math.max(0, player.airTime - dt);
    if (player.airTime === 0) player.hopping = false;
  }

  const vx = TURN_SPEED_X[player.state] || 0;
  let baseVy = FORWARD_SPEED[player.state] || 200;
  if (player.airTime > 0 && !player.hopping) baseVy *= JUMP_SPEED_MULT;
  const vy = baseVy * speedMult;

  player.x += vx * dt;
  player.y += vy * dt;
  return vy * dt;
}

export function crashPlayer(player) {
  player.crashTimer = 1.5;
  player.state = 'crashed';
}
