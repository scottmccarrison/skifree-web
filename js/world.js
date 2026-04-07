// World: chunk-based obstacle spawning. The world is an infinite 2D grid of
// chunks; whenever a chunk near the player hasn't been spawned yet, we fill it.

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

function pickType() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const t of TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TYPES[0];
}

export function createWorld() {
  return {
    obstacles: [],
    spawnedChunks: new Set(), // "cx,cy" keys
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
      spawnChunk(world, cx, cy, difficulty);
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

function spawnChunk(world, cx, cy, difficulty) {
  // Player starts at (0, 0). Keep the very first chunks empty so they
  // can't crash on spawn.
  if (cy <= 0 && Math.abs(cx) <= 1) return;

  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  // ~2-5 obstacles per chunk depending on difficulty.
  const count = 2 + Math.floor(Math.random() * (2 + difficulty));
  for (let i = 0; i < count; i++) {
    const t = pickType();
    world.obstacles.push({
      type: t,
      x: x0 + Math.random() * CHUNK,
      y: y0 + Math.random() * CHUNK,
    });
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
