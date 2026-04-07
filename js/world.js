// World: chunk-based obstacle spawning. The world is an infinite 2D grid of
// chunks; whenever a chunk near the player hasn't been spawned yet, we fill it.

const CHUNK = 200; // world units per chunk side

const TYPES = [
  { kind: 'treeLarge', w: 36, h: 40, weight: 3, deadly: true },
  { kind: 'treeSmall', w: 22, h: 24, weight: 4, deadly: true },
  { kind: 'rock',      w: 22, h: 18, weight: 2, deadly: true },
  { kind: 'stump',     w: 18, h: 10, weight: 2, deadly: true },
  { kind: 'mogul',     w: 28, h: 12, weight: 5, deadly: false },
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
  const px0 = player.x - player.width / 2;
  const px1 = player.x + player.width / 2;
  const py0 = player.y;
  const py1 = player.y + player.height;

  for (const o of world.obstacles) {
    const ox0 = o.x - o.type.w / 2;
    const ox1 = o.x + o.type.w / 2;
    const oy0 = o.y - o.type.h / 2;
    const oy1 = o.y + o.type.h / 2;
    if (px0 < ox1 && px1 > ox0 && py0 < oy1 && py1 > oy0) {
      return o;
    }
  }
  return null;
}
