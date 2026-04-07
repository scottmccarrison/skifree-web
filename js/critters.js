// Horizontal-running critters (squirrels). Spawn at the side of the visible
// area, sprint across the slope at constant horizontal velocity, despawn
// when fully offscreen. Deadly on contact unless the player is airborne
// (existing mid-air invincibility lets you jump them).
//
// Per-player local: each client runs its own critter field. They're a
// reaction-test hazard, not a shared world feature, so there's no need to
// sync them over the network in MP.

const SPAWN_AFTER_SCORE = 300;       // meters before any critter appears
const BASE_SPEED = 120;              // horizontal world units / second
const MIN_INTERVAL = 4.0;            // seconds between spawns (early)
const MAX_INTERVAL = 8.0;
const HITBOX_W = 14;
const HITBOX_H = 10;

export function createCritters() {
  return {
    list: [],
    nextSpawnIn: MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL),
  };
}

export function resetCritters(critters) {
  critters.list.length = 0;
  critters.nextSpawnIn = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

export function updateCritters(critters, player, viewport, dt, score, speedMult) {
  // Move existing critters and despawn ones that have left the visible band.
  for (const c of critters.list) {
    c.x += c.vx * dt;
  }
  // Despawn anything well outside the viewport horizontally.
  const camX = player.x;
  critters.list = critters.list.filter(c => Math.abs(c.x - camX) < viewport.w);

  if (score < SPAWN_AFTER_SCORE) return;

  critters.nextSpawnIn -= dt;
  if (critters.nextSpawnIn > 0) return;

  // Schedule next spawn. Tighten interval slightly with speedMult so the
  // late game has more pressure.
  const intervalScale = 1 / Math.max(1, speedMult);
  critters.nextSpawnIn = (MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) * intervalScale;

  // Spawn at one edge of the visible area, run toward the other edge.
  // Y placement: somewhere ahead of the player so they have time to react.
  const fromLeft = Math.random() < 0.5;
  const halfW = viewport.w / 2;
  const x = player.x + (fromLeft ? -halfW - 20 : halfW + 20);
  // Place ahead of the player by 60-160 world units (player descends into it).
  const y = player.y + 60 + Math.random() * 100;
  const vx = (fromLeft ? 1 : -1) * BASE_SPEED * speedMult;
  critters.list.push({ x, y, vx, w: HITBOX_W, h: HITBOX_H });
}

export function checkCritterCollision(critters, player) {
  // Mid-air invincibility: same rule as deadly obstacles.
  if (player.airTime && player.airTime > 0) return false;
  const px0 = player.x - 9, px1 = player.x + 9;
  const py0 = player.y, py1 = player.y + 28;
  for (const c of critters.list) {
    const cx0 = c.x - c.w / 2, cx1 = c.x + c.w / 2;
    const cy0 = c.y - c.h / 2, cy1 = c.y + c.h / 2;
    if (px0 < cx1 && px1 > cx0 && py0 < cy1 && py1 > cy0) return true;
  }
  return false;
}
