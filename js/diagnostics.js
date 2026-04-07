// Diagnostics: collect rich client-side context for feedback submissions.
// Goal: when a user reports a bug (especially "I crashed and didn't see why"),
// the GitHub issue should contain enough state to reproduce or diagnose.

const INPUT_LOG_MAX = 30;
const inputLog = []; // {t, ev} - ev like 'left+', 'left-', 'right+', etc.

let lastCrashSnapshot = null;

export function logInput(ev) {
  inputLog.push({ t: Date.now(), ev });
  if (inputLog.length > INPUT_LOG_MAX) inputLog.shift();
}

export function captureCrashSnapshot(game) {
  try {
    lastCrashSnapshot = {
      at: Date.now(),
      score: Math.floor(game.score),
      elapsed: +game.elapsed.toFixed(2),
      player: {
        x: Math.round(game.player.x),
        y: Math.round(game.player.y),
        state: game.player.state,
        airTime: +game.player.airTime.toFixed(2),
      },
      yeti: game.yeti.active ? {
        x: Math.round(game.yeti.x),
        y: Math.round(game.yeti.y),
        dist: Math.round(Math.hypot(game.yeti.x - game.player.x, game.yeti.y - game.player.y)),
      } : null,
      nearbyObstacles: game.world.obstacles
        .filter(o => Math.abs(o.x - game.player.x) < 120 && Math.abs(o.y - game.player.y) < 200)
        .slice(0, 20)
        .map(o => ({
          kind: o.type.kind,
          dx: Math.round(o.x - game.player.x),
          dy: Math.round(o.y - game.player.y),
        })),
    };
  } catch (e) {
    lastCrashSnapshot = { error: String(e) };
  }
}

export function buildDiagnosticsMeta(game) {
  const lines = [];
  lines.push(`device: ${navigator.userAgent}`);
  lines.push(`viewport: ${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio || 1}`);
  lines.push(`state: ${game.state}`);
  lines.push(`score: ${Math.floor(game.score)} m   best: ${Math.floor(game.highScore)} m   elapsed: ${game.elapsed.toFixed(1)}s`);
  lines.push(`player: x=${Math.round(game.player.x)} y=${Math.round(game.player.y)} state=${game.player.state} air=${game.player.airTime.toFixed(2)}`);
  if (game.yeti.active) {
    const dist = Math.round(Math.hypot(game.yeti.x - game.player.x, game.yeti.y - game.player.y));
    lines.push(`yeti: active dist=${dist}`);
  } else {
    lines.push(`yeti: dormant (spawn in ${Math.max(0, 50 - game.yeti.spawnTimer).toFixed(0)}s)`);
  }
  const nearby = game.world.obstacles
    .filter(o => Math.abs(o.x - game.player.x) < 120 && Math.abs(o.y - game.player.y) < 200);
  lines.push(`nearby obstacles (${nearby.length}): ${nearby.slice(0, 10).map(o => o.type.kind).join(', ')}`);
  if (inputLog.length) {
    const recent = inputLog.slice(-12).map(e => e.ev).join(' ');
    lines.push(`recent input: ${recent}`);
  }
  if (lastCrashSnapshot) {
    const ageMs = Date.now() - (lastCrashSnapshot.at || 0);
    if (ageMs < 60_000) {
      lines.push(`last crash (${(ageMs/1000).toFixed(0)}s ago): ${JSON.stringify(lastCrashSnapshot)}`);
    }
  }
  return lines.join('\n');
}
