// Yeti: spawns after threshold, chases the player in 2D until contact.
// Periodically does a "flyby" at the screen edge so the player actually
// sees the threat even on long runs.

const SPAWN_AFTER_SECONDS = 35;
const BASE_CHASE_SPEED = 200;     // straight player is 220 - going straight still escapes, weavers feel pressure
const FLYBY_INTERVAL_SEC = 10;
const FLYBY_FAR_THRESHOLD = 350;  // threshold in world units - any gap larger than this can trigger a flyby

import { hashChunk } from './rng.js';

export function createYeti(seed) {
  return {
    active: false,
    x: 0,
    y: 0,
    width: 28,
    height: 36,
    spawnTimer: 0,
    flybyTimer: 0,
    seed: (seed === undefined ? Date.now() : seed) >>> 0,
    flybyCounter: 0,
  };
}

export function updateYeti(yeti, player, dt, difficulty = 1, speedMult = 1) {
  if (!yeti.active) {
    yeti.spawnTimer += dt;
    if (yeti.spawnTimer >= SPAWN_AFTER_SECONDS) {
      yeti.active = true;
      // Spawn closer so the yeti is visible/looming almost immediately
      // instead of being offscreen for the first several seconds.
      yeti.y = player.y - 400;
      yeti.x = player.x;
      // First flyby fires soon after spawn so the player notices it.
      yeti.flybyTimer = FLYBY_INTERVAL_SEC * 0.55;
    }
    return false;
  }

  // Chase in 2D toward the player. Slightly slower than max straight skiing
  // so a player going straight stays ahead - but turning, hitting moguls, or
  // weaving around trees lets the yeti close the gap. Difficulty adds a small
  // bonus so the chase tightens later in the run.
  // Scale by the *target's* current speedMult so the yeti tracks the player
  // it's actually chasing - in MP that's the slowest alive player. Strictly
  // proportional: base speed only, no difficulty stacking. Player straight
  // = 220*speedMult; yeti base = 200*speedMult; gap stays a clean ~20 units
  // after speedMult so going straight always escapes and weavers pay.
  // (Difficulty is intentionally unused now - it was double-scaling and made
  // the yeti faster than the player past ~60s. The flyby mechanic still
  // keeps the threat felt visually.)
  const speed = BASE_CHASE_SPEED * speedMult;
  void difficulty;
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
    const side = (hashChunk(yeti.seed, yeti.flybyCounter, 0) & 1) ? -1 : 1;
    yeti.flybyCounter++;
    yeti.x = player.x + side * 250;
    yeti.y = player.y - 300;
  }

  return checkYetiCollision(yeti, player);
}

// Exact AABB used by updateYeti, exported so non-host MP clients can run the
// same collision check against a network-driven yeti position.
export function checkYetiCollision(yeti, player) {
  if (!yeti.active) return false;
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
  yeti.flybyCounter = 0;
}
