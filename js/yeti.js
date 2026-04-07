// Yeti: spawns after threshold, chases until contact = game over.

const SPAWN_AFTER_SECONDS = 25;
const CHASE_SPEED = 260; // a bit faster than max player forward speed

export function createYeti() {
  return {
    active: false,
    x: 0,
    y: 0,
    width: 28,
    height: 36,
    spawnTimer: 0,
  };
}

export function updateYeti(yeti, player, dt) {
  if (!yeti.active) {
    yeti.spawnTimer += dt;
    if (yeti.spawnTimer >= SPAWN_AFTER_SECONDS) {
      yeti.active = true;
      yeti.y = player.y - 600; // start above the screen
      yeti.x = player.x;
    }
    return false;
  }

  // Chase the player. Move y toward player.y at CHASE_SPEED, ease x.
  const dy = player.y - yeti.y;
  const sgn = Math.sign(dy);
  yeti.y += sgn * CHASE_SPEED * dt;
  yeti.x += (player.x - yeti.x) * Math.min(1, dt * 1.5);

  // Contact check (AABB).
  const px0 = player.x - 9, px1 = player.x + 9;
  const py0 = player.y, py1 = player.y + 28;
  const yx0 = yeti.x - yeti.width / 2, yx1 = yeti.x + yeti.width / 2;
  const yy0 = yeti.y - yeti.height / 2, yy1 = yeti.y + yeti.height / 2;
  return px0 < yx1 && px1 > yx0 && py0 < yy1 && py1 > yy0;
}

export function resetYeti(yeti) {
  yeti.active = false;
  yeti.spawnTimer = 0;
}
