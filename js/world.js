// World: chunk-based obstacle spawning. The world is an infinite 2D grid of
// chunks; whenever a chunk near the player hasn't been spawned yet, we fill it.

import { mulberry32, hashChunk } from './rng.js';

const CHUNK = 200; // world units per chunk side

// Each type has a tight `hit` box centered at (sprite center + dx, dy).
// These are intentionally smaller than the visible sprite so collisions feel
// fair - you only crash when you actually hit the trunk/rock/etc.
const TYPES = [
  { kind: 'treeLarge', weight: 3, deadly: true,
    hit: { dx: 0, dy: 14, w: 10, h: 10 } },   // trunk + low foliage
  { kind: 'treeSmall', weight: 4, deadly: true,
    hit: { dx: 0, dy: 8,  w: 8,  h: 8  } },   // small trunk
  { kind: 'rock',      weight: 2, deadly: true,
    hit: { dx: 0, dy: 0,  w: 18, h: 12 } },
  { kind: 'stump',     weight: 2, deadly: true,
    hit: { dx: 0, dy: 0,  w: 14, h: 8  } },
  { kind: 'mogul',     weight: 5, deadly: false,
    hit: { dx: 0, dy: 0,  w: 22, h: 8  } },
  { kind: 'jump',      weight: 2, deadly: false,
    hit: { dx: 0, dy: 0,  w: 28, h: 10 } },
];

const TOTAL_WEIGHT = TYPES.reduce((s, t) => s + t.weight, 0);

function pickType(rng) {
  let r = rng() * TOTAL_WEIGHT;
  for (const t of TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TYPES[0];
}

export function createWorld(seed) {
  return {
    obstacles: [],
    spawnedChunks: new Set(), // "cx,cy" keys
    seed: (seed === undefined ? Date.now() : seed) >>> 0,
  };
}

export function updateWorld(world, player, viewport, difficulty = 1) {
  // Determine which chunks should be populated: a rectangle around the player
  // that extends further down (where they're going) than up.
  const halfW = Math.max(viewport.w, 700) + CHUNK;
  const aheadH = viewport.h * 1.5 + CHUNK;
  const behindH = viewport.h * 0.5 + CHUNK;

  const cx0 = Math.floor((player.x - halfW) / CHUNK);
  const cx1 = Math.floor((player.x + halfW) / CHUNK);
  const cy0 = Math.floor((player.y - behindH) / CHUNK);
  const cy1 = Math.floor((player.y + aheadH) / CHUNK);

  for (let cy = cy0; cy <= cy1; cy++) {
    // Don't spawn obstacles in the player's starting safe zone.
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy;
      if (world.spawnedChunks.has(key)) continue;
      world.spawnedChunks.add(key);
      spawnChunk(world, cx, cy);
    }
  }

  // Cull obstacles far outside the active region.
  const cullW = halfW + CHUNK;
  const cullTop = player.y - viewport.h - CHUNK;
  world.obstacles = world.obstacles.filter(o =>
    o.y >= cullTop && Math.abs(o.x - player.x) <= cullW
  );

  // Also forget chunks that are far away so memory doesn't grow forever.
  if (world.spawnedChunks.size > 2000) {
    const keep = new Set();
    for (let cy = cy0 - 2; cy <= cy1 + 2; cy++) {
      for (let cx = cx0 - 2; cx <= cx1 + 2; cx++) {
        const key = cx + ',' + cy;
        if (world.spawnedChunks.has(key)) keep.add(key);
      }
    }
    world.spawnedChunks = keep;
  }
}

// Minimum gap (world units) between any two obstacle hit boxes.
const MIN_GAP = 14;

function overlapsExisting(world, t, x, y) {
  const ah = t.hit;
  const ax0 = x + ah.dx - ah.w / 2 - MIN_GAP;
  const ax1 = x + ah.dx + ah.w / 2 + MIN_GAP;
  const ay0 = y + ah.dy - ah.h / 2 - MIN_GAP;
  const ay1 = y + ah.dy + ah.h / 2 + MIN_GAP;
  // Only need to test obstacles within a chunk's reach (cheap linear scan -
  // chunks are small and the overall list is bounded by the cull region).
  for (const o of world.obstacles) {
    if (Math.abs(o.x - x) > 80 || Math.abs(o.y - y) > 80) continue;
    const bh = o.type.hit;
    const bx0 = o.x + bh.dx - bh.w / 2;
    const bx1 = o.x + bh.dx + bh.w / 2;
    const by0 = o.y + bh.dy - bh.h / 2;
    const by1 = o.y + bh.dy + bh.h / 2;
    if (ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0) return true;
  }
  return false;
}

function spawnChunk(world, cx, cy) {
  // Player starts at (0, 0). Keep the very first chunks empty so they
  // can't crash on spawn.
  if (cy <= 0 && Math.abs(cx) <= 1) return;

  const rng = mulberry32(hashChunk(world.seed, cx, cy));
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  // Difficulty derived from chunk position (not elapsed time) so that
  // chunk content is purely a function of (seed, cx, cy).
  const chunkDifficulty = 1 + Math.min(4, Math.abs(cy) / 10);
  // ~2-5 obstacles per chunk depending on chunkDifficulty.
  const count = 2 + Math.floor(rng() * (2 + chunkDifficulty));
  for (let i = 0; i < count; i++) {
    const t = pickType(rng);
    // Rejection sample: try a handful of positions, skip if all overlap.
    let placed = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = x0 + rng() * CHUNK;
      const y = y0 + rng() * CHUNK;
      if (!overlapsExisting(world, t, x, y)) {
        world.obstacles.push({ type: t, x, y });
        placed = true;
        break;
      }
    }
    // If we couldn't fit it, just drop the spawn for this slot - keeps the
    // map breathable rather than forcing a juxtaposition.
    void placed;
  }
}

export function checkCollisions(world, player) {
  const ph = player.hit;
  const pcx = player.x + ph.dx;
  const pcy = player.y + ph.dy;
  const px0 = pcx - ph.w / 2, px1 = pcx + ph.w / 2;
  const py0 = pcy - ph.h / 2, py1 = pcy + ph.h / 2;

  for (const o of world.obstacles) {
    const oh = o.type.hit;
    const ocx = o.x + oh.dx;
    const ocy = o.y + oh.dy;
    const ox0 = ocx - oh.w / 2, ox1 = ocx + oh.w / 2;
    const oy0 = ocy - oh.h / 2, oy1 = ocy + oh.h / 2;
    if (px0 < ox1 && px1 > ox0 && py0 < oy1 && py1 > oy0) {
      return o;
    }
  }
  return null;
}
