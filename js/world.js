// World: obstacles spawn ahead of player, despawn behind. AABB collision.

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
    spawnedTo: 0,    // y up to which we've spawned
    rowHeight: 90,   // spacing between obstacle rows
    halfWidth: 320,  // logical world half-width for spawning
  };
}

export function updateWorld(world, player, viewport) {
  // Spawn obstacles ahead of player up to (player.y + lookahead).
  const lookahead = viewport.h * 1.5;
  const spawnUntil = player.y + lookahead;

  while (world.spawnedTo < spawnUntil) {
    world.spawnedTo += world.rowHeight;
    const count = 1 + Math.floor(Math.random() * 3); // 1-3 per row
    for (let i = 0; i < count; i++) {
      const t = pickType();
      world.obstacles.push({
        type: t,
        x: (Math.random() * 2 - 1) * world.halfWidth,
        y: world.spawnedTo + (Math.random() - 0.5) * world.rowHeight * 0.8,
      });
    }
  }

  // Despawn anything well above the player.
  const cullY = player.y - viewport.h;
  if (world.obstacles.length > 0 && world.obstacles[0].y < cullY) {
    world.obstacles = world.obstacles.filter(o => o.y >= cullY);
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
