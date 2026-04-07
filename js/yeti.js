// Yeti: spawns after threshold, chases the player in 2D until contact.

const SPAWN_AFTER_SECONDS = 50;
const BASE_CHASE_SPEED = 195;

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

export function updateYeti(yeti, player, dt, difficulty = 1) {
  if (!yeti.active) {
    yeti.spawnTimer += dt;
    if (yeti.spawnTimer >= SPAWN_AFTER_SECONDS) {
      yeti.active = true;
      yeti.y = player.y - 600;
      yeti.x = player.x;
    }
    return false;
  }

  // Chase in 2D toward the player. Slightly slower than max straight skiing
  // so a player going straight stays ahead - but turning, hitting moguls, or
  // weaving around trees lets the yeti close the gap. Difficulty adds a small
  // bonus so the chase tightens later in the run.
  const speed = BASE_CHASE_SPEED + difficulty * 18;
  const dx = player.x - yeti.x;
  const dy = player.y - yeti.y;
  const dist = Math.hypot(dx, dy) || 1;
  yeti.x += (dx / dist) * speed * dt;
  yeti.y += (dy / dist) * speed * dt;

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
