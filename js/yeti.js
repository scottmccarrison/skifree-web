// Yeti: spawns after threshold, chases the player in 2D until contact.
// Periodically does a "flyby" at the screen edge so the player actually
// sees the threat even on long runs.

const SPAWN_AFTER_SECONDS = 35;
const BASE_CHASE_SPEED = 215;     // straight player is 220 - going straight still escapes
const FLYBY_INTERVAL_SEC = 22;
const FLYBY_FAR_THRESHOLD = 800;  // only flyby if currently more than this far away

export function createYeti() {
  return {
    active: false,
    x: 0,
    y: 0,
    width: 28,
    height: 36,
    spawnTimer: 0,
    flybyTimer: 0,
  };
}

export function updateYeti(yeti, player, dt, difficulty = 1) {
  if (!yeti.active) {
    yeti.spawnTimer += dt;
    if (yeti.spawnTimer >= SPAWN_AFTER_SECONDS) {
      yeti.active = true;
      yeti.y = player.y - 600;
      yeti.x = player.x;
      yeti.flybyTimer = 0;
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

  // Flyby: if the yeti has drifted far away, periodically teleport it to a
  // flanking position visible at the screen edge so the threat stays felt.
  // Doesn't put the player in immediate danger - it lands ~250 units laterally
  // and ~300 units behind, so a straight skier still pulls away.
  yeti.flybyTimer += dt;
  if (yeti.flybyTimer >= FLYBY_INTERVAL_SEC && dist > FLYBY_FAR_THRESHOLD) {
    yeti.flybyTimer = 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    yeti.x = player.x + side * 250;
    yeti.y = player.y - 300;
  }

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
  yeti.flybyTimer = 0;
}
