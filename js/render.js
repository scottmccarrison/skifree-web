import {
  drawTreeLarge, drawTreeSmall, drawMogul, drawRock, drawStump, drawJump,
  drawPlayer, drawYeti, drawSquirrel,
} from './sprites.js';

// Legend wrapper: squirrel sprite is offset upward in its own art so it
// reads at the same baseline as the other obstacles in the legend grid.
function drawSquirrelLegend(ctx) { drawSquirrel(ctx, 1); }
import { getStoredName } from './leaderboard.js';
import { colorForIndex } from './colors.js';

let _spriteCanvas = null;
function getSpriteCanvas() {
  if (!_spriteCanvas) {
    _spriteCanvas = document.createElement('canvas');
    _spriteCanvas.width = 60;
    _spriteCanvas.height = 60;
  }
  return _spriteCanvas;
}

function drawTintedPlayerAt(ctx, screenX, screenY, state, color, alpha) {
  const sc = getSpriteCanvas();
  const sctx = sc.getContext('2d');
  sctx.clearRect(0, 0, sc.width, sc.height);
  sctx.save();
  sctx.translate(sc.width / 2, sc.height / 2);
  drawPlayer(sctx, state);
  sctx.restore();
  sctx.save();
  sctx.globalCompositeOperation = 'source-atop';
  sctx.fillStyle = color;
  sctx.globalAlpha = 0.5;
  sctx.fillRect(0, 0, sc.width, sc.height);
  sctx.restore();
  ctx.save();
  if (typeof alpha === 'number') ctx.globalAlpha = alpha;
  ctx.drawImage(sc, screenX - sc.width / 2, screenY - sc.height / 2);
  ctx.restore();
}

const LEGEND = [
  { draw: drawTreeLarge,     label: 'tree - CRASH' },
  { draw: drawRock,          label: 'rock - CRASH' },
  { draw: drawStump,         label: 'stump - CRASH' },
  { draw: drawSquirrelLegend, label: 'squirrel - CRASH' },
  { draw: drawJump,          label: 'log - JUMP (boost)' },
  { draw: drawMogul,         label: 'mogul - HOP (bump)' },
  { draw: drawYeti,          label: 'yeti - RUN!' },
];

const SPRITE_FNS = {
  treeLarge: drawTreeLarge,
  treeSmall: drawTreeSmall,
  mogul: drawMogul,
  rock: drawRock,
  stump: drawStump,
  jump: drawJump,
};

// Hit regions registered each frame so the canvas click handler in main.js
// can map clicks to UI actions. Each entry: {x, y, w, h, action, data}.
export const hitRegions = [];

function lerpRemote(remote) {
  // Interpolate from prev->cur over the snapshot interval. Lags one snapshot
  // for smoothness; if no prev, just return cur.
  if (!remote.prevT || !remote.lastT || remote.lastT === remote.prevT) {
    return { x: remote.x, y: remote.y };
  }
  const now = performance.now() / 1000;
  const span = remote.lastT - remote.prevT;
  const t = Math.min(1, Math.max(0, (now - remote.lastT) / span));
  return {
    x: remote.prevX + (remote.x - remote.prevX) * t,
    y: remote.prevY + (remote.y - remote.prevY) * t,
  };
}

export function render(ctx, viewport, game) {
  hitRegions.length = 0;
  const { player, world, yeti, state, score, highScore, deathCount } = game;

  // Progression layers: every 1000m unlocks a new visual element so the
  // player can feel how far they've gone without watching the score.
  // Bands cycle every 6000m so the visual journey continues forever.
  const bandScore = score % 6000;
  const stage = Math.floor(bandScore / 1000);
  const cycle = Math.floor(score / 6000);
  const inverted = stage >= 5;

  let bg;
  if (inverted) {
    bg = '#ffffff';
  } else if (stage >= 4) {
    // Aurora tint (purple/teal wash) at 4-5k.
    bg = `rgb(180, 200, 230)`;
  } else {
    // 244 -> 150 across 4 steps.
    const v = Math.max(150, 244 - stage * 24);
    bg = `rgb(${v}, ${v + 4}, ${v + 8})`;
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, viewport.w, viewport.h);

  // Aurora streaks (stage 4).
  if (stage === 4) {
    const t = (game.elapsed || 0) * 0.6;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      const grad = ctx.createLinearGradient(0, 0, viewport.w, 0);
      grad.addColorStop(0, '#7be6c4');
      grad.addColorStop(0.5, '#a98cf0');
      grad.addColorStop(1, '#7be6c4');
      ctx.fillStyle = grad;
      const yy = 40 + i * 50 + Math.sin(t + i) * 10;
      ctx.fillRect(0, yy, viewport.w, 12);
      ctx.restore();
    }
  }

  // Drifting snowflakes (stage 1+).
  if (state === 'playing' && stage >= 1) {
    const flakeCount = Math.min(40, 8 + stage * 8);
    drawSnowflakes(ctx, viewport, game.elapsed || 0, flakeCount);
  }

  // Camera: prefer the smoothed cameraPos so spectator switches glide
  // instead of teleporting. World generation still uses cameraTarget so
  // chunks stay aligned even if the visual lags slightly.
  const cameraSrc = game.cameraPos || game.cameraTarget || player;
  const camX = cameraSrc.x - viewport.w / 2;
  const camY = cameraSrc.y - viewport.h / 3;

  // Draw obstacles in view.
  for (const o of world.obstacles) {
    const sx = o.x - camX;
    const sy = o.y - camY;
    if (sx < -60 || sx > viewport.w + 60) continue;
    if (sy < -60 || sy > viewport.h + 60) continue;
    ctx.save();
    ctx.translate(sx, sy);
    SPRITE_FNS[o.type.kind](ctx, score);
    ctx.restore();
  }

  // Critters (squirrels).
  if (game.critters && game.critters.list) {
    for (const c of game.critters.list) {
      const sx = c.x - camX;
      const sy = c.y - camY;
      if (sx < -30 || sx > viewport.w + 30) continue;
      if (sy < -30 || sy > viewport.h + 30) continue;
      ctx.save();
      ctx.translate(sx, sy);
      drawSquirrel(ctx, c.vx >= 0 ? 1 : -1);
      ctx.restore();
    }
  }

  // Yeti.
  if (yeti.active) {
    const sx = yeti.x - camX;
    const sy = yeti.y - camY;
    ctx.save();
    ctx.translate(sx, sy);
    drawYeti(ctx);
    ctx.restore();
  }

  // Player. Lift off the ground + cast a shadow when airborne.
  const airT = player.airTime;
  const lift = airT > 0 ? Math.sin((1 - airT / 0.7) * Math.PI) * 18 : 0;
  if (airT > 0) {
    ctx.save();
    ctx.translate(player.x - camX, player.y - camY + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (game.mode === 'mp') {
    const localColor = colorForIndex(game.localColor != null ? game.localColor : 0);
    drawTintedPlayerAt(ctx, player.x - camX, player.y - camY - lift, player.state, localColor, 1.0);
  } else {
    ctx.save();
    ctx.translate(player.x - camX, player.y - camY - lift);
    drawPlayer(ctx, player.state);
    ctx.restore();
  }

  // Remote skiers (multiplayer): tinted translucent overlay per peer.
  if (game.mode === 'mp' && game.remotes && game.remotes.size > 0) {
    for (const remote of game.remotes.values()) {
      const lr = lerpRemote(remote);
      const color = colorForIndex(remote.color);
      const alpha = remote.alive ? 0.55 : 0.25;
      drawTintedPlayerAt(ctx, lr.x - camX, lr.y - camY, remote.state || 'straight', color, alpha);
    }
  }

  // Night mode: invert everything drawn so far via 'difference' with white.
  if (inverted) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.w, viewport.h);
    ctx.restore();
  }

  // HUD (drawn after invert so its color is always readable).
  ctx.fillStyle = inverted ? '#f4faff' : '#1a1a1a';
  ctx.font = 'bold 18px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(score)} m`, 16, 28);
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  ctx.fillText(`best: ${Math.floor(highScore)} m`, 16, 46);
  ctx.fillText(`deaths: ${deathCount || 0}`, 16, 62);
  if (game.mode === 'mp' && game.remotes) {
    const all = [];
    all.push({
      name: 'YOU',
      color: game.localColor != null ? game.localColor : 0,
      score: Math.floor(game.score || 0),
      alive: !game.spectating && game.player.state !== 'crashed',
    });
    for (const r of game.remotes.values()) {
      all.push({
        name: r.name || `anon${r.id}`,
        color: r.color,
        score: Math.floor(r.score || 0),
        alive: r.alive,
      });
    }
    all.sort((a, b) => b.score - a.score);
    const startX = 16;
    const startY = 78;
    const rowH = 14;
    ctx.save();
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const y = startY + i * rowH;
      ctx.fillStyle = colorForIndex(p.color);
      ctx.fillRect(startX, y + 2, 10, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + 0.5, y + 2.5, 9, 9);
      ctx.fillStyle = p.alive ? (inverted ? '#f4faff' : '#1a1a1a') : '#888';
      const nm = p.name.length > 8 ? p.name.slice(0, 8) : p.name;
      let label = `${nm} ${p.score}`;
      if (!p.alive) label += ' x';
      ctx.fillText(label, startX + 16, y);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  // State overlays.
  if (state === 'title') {
    drawCenteredPanel(ctx, viewport, game, {
      title: 'SKI FREE',
      hint: game.hint,
      lines: [],
      legend: true,
      restart: true,
      restartLabel: 'START',
      multiplayer: true,
    });
  } else if (state === 'gameover') {
    // In MP, the gameover screen is the multiplayer modal (opened from main.js
    // when state transitions to gameover). The canvas panel is suppressed so
    // the lobby-style roster with ready checkmarks is the only thing visible.
    if (game.mode !== 'mp') {
      drawCenteredPanel(ctx, viewport, game, {
        title: 'GAME OVER',
        hint: game.hint,
        lines: [`${Math.floor(score)} m`],
        restart: true,
        multiplayer: true,
      });
    }
  }
}

function drawSnowflakes(ctx, viewport, t, count) {
  if (viewport.w <= 0 || viewport.h <= 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const W = viewport.w + 40;
  for (let i = 0; i < count; i++) {
    // Deterministic per-flake offsets so they don't strobe.
    const seed = i * 12.9898;
    const sx = ((Math.sin(seed) * 43758) % 1 + 1) % 1;
    const sy = ((Math.sin(seed + 1.7) * 43758) % 1 + 1) % 1;
    const speed = 20 + ((i * 7) % 30);
    // Diagonal drift: each flake travels horizontally proportional to its
    // fall speed, wrapping across an extended width so it never strands.
    const baseX = sx * W;
    const x = ((baseX + Math.sin(t * 0.5 + i) * 8 + t * speed * 0.25) % W + W) % W - 20;
    const y = (sy * viewport.h + t * speed) % viewport.h;
    const r = 1.2 + ((i * 3) % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function formatResetIn(ms) {
  if (ms <= 0) return 'resetting...';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `resets in ${h}h ${m}m`;
}

function drawCenteredPanel(ctx, viewport, game, panel) {
  const { title, hint, lines, legend, restart, restartLabel, multiplayer } = panel;
  const restartHeight = restart ? 44 : 0;
  const board = game.leaderboard;
  const tab = game.leaderboardTab || 'daily';
  const legendRows = legend ? Math.ceil(LEGEND.length / 2) : 0;
  const legendHeight = legend ? 18 + legendRows * 26 : 0;

  // Determine which rows to render based on the active tab.
  let rows = [];
  let emptyText = 'be the first!';
  let footer = '';
  let topEverHeader = null;
  if (board) {
    if (tab === 'daily') {
      rows = board.daily || [];
      if (board.resetsAt) footer = formatResetIn(board.resetsAt - Date.now());
      emptyText = 'no runs today - go!';
    } else if (tab === 'alltime') {
      rows = board.alltime || [];
      if (board.topEver) {
        topEverHeader = board.topEver;
      }
    } else if (tab === 'you') {
      const pbName = getStoredName().trim() || 'anon';
      rows = (game.personalBests || []).map(pb => ({
        name: pbName,
        score: pb.score,
        created_at: pb.at,
      }));
      emptyText = 'no personal bests yet';
    }
  }

  const lbRows = Math.min(10, rows.length);
  const tabsHeight = board ? 30 : 0;
  const headerHeight = topEverHeader ? 22 : 0;
  const lbHeight = board ? tabsHeight + headerHeight + 18 + lbRows * 18 + (footer ? 18 : 0) + 8 : 0;
  const hintHeight = hint ? 28 : 0;

  const cx = viewport.w / 2;
  const cy = viewport.h / 2;
  const w = Math.min(viewport.w - 40, 380);
  const h = 90 + hintHeight + lines.length * 22 + legendHeight + lbHeight + restartHeight + 30;

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cx - w/2, cy - h/2, w, h, 12)
                : ctx.rect(cx - w/2, cy - h/2, w, h);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  let y = cy - h/2 + 36;

  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.fillText(title, cx, y);
  y += 30;

  if (hint) {
    ctx.font = 'italic 13px -apple-system, system-ui, sans-serif';
    ctx.fillText(`tip: ${hint}`, cx, y);
    y += 24;
  }

  ctx.font = '15px -apple-system, system-ui, sans-serif';
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += 22;
  }

  if (legend) {
    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OBSTACLES', cx, y + 4);
    y += 18;
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const colW = (w - 32) / 2;
    for (let i = 0; i < LEGEND.length; i++) {
      const item = LEGEND[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = cx - w/2 + 16 + col * colW + 18;
      const iy = y + row * 26 + 12;
      // Sprite icon
      ctx.save();
      ctx.translate(ix, iy);
      ctx.scale(0.55, 0.55);
      item.draw(ctx, 9999);
      ctx.restore();
      // Label
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(item.label, ix + 18, iy + 4);
    }
    y += legendRows * 26;
    ctx.textAlign = 'center';
  }

  if (board) {
    y += 4;
    // Tabs.
    const tabs = [
      { key: 'daily',   label: 'DAILY' },
      { key: 'alltime', label: 'ALL TIME' },
      { key: 'you',     label: 'PERSONAL' },
    ];
    const tabW = (w - 32) / tabs.length;
    const tabY = y;
    ctx.font = 'bold 12px -apple-system, system-ui, sans-serif';
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      const tx = cx - w/2 + 16 + i * tabW;
      const active = t.key === tab;
      ctx.fillStyle = active ? '#1a1a1a' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(tx + 2, tabY, tabW - 4, 22);
      ctx.fillStyle = active ? '#fff' : '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.fillText(t.label, tx + tabW/2, tabY + 15);
      hitRegions.push({
        x: tx + 2, y: tabY, w: tabW - 4, h: 22,
        action: 'setTab', data: t.key,
      });
    }
    ctx.fillStyle = '#1a1a1a';
    y += tabsHeight;

    // All-time tab: persistent top-ever crown header.
    if (topEverHeader && tab === 'alltime') {
      ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const name = (topEverHeader.name || 'anon').slice(0, 14);
      ctx.fillText(`top: ${name} - ${topEverHeader.score} m`, cx, y + 14);
      y += headerHeight;
    }

    ctx.font = '13px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    const colLeft = cx - w/2 + 24;
    const colRight = cx + w/2 - 24;
    y += 4;
    for (let i = 0; i < lbRows; i++) {
      const row = rows[i];
      const rank = String(i + 1).padStart(2, ' ');
      const name = (row.name || 'anon').slice(0, 14);
      const sc = `${row.score} m`;
      ctx.fillText(`${rank}. ${name}`, colLeft, y + 14);
      ctx.textAlign = 'right';
      ctx.fillText(sc, colRight, y + 14);
      ctx.textAlign = 'left';
      y += 18;
    }
    if (lbRows === 0) {
      ctx.textAlign = 'center';
      ctx.fillText(emptyText, cx, y + 14);
      y += 18;
    }
    if (footer) {
      ctx.textAlign = 'center';
      ctx.font = 'italic 11px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#555';
      ctx.fillText(footer, cx, y + 14);
      ctx.fillStyle = '#1a1a1a';
    }
    ctx.textAlign = 'center';
  }

  // Restart button: always bottom-center, fixed position regardless of gift.
  if (restart) {
    const btnW = Math.min(w - 64, 200);
    const btnH = 36;
    const bx = cx - btnW / 2;
    const by = cy + h/2 - 22 - btnH;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, btnW, btnH, 8);
    else ctx.rect(bx, by, btnW, btnH);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(restartLabel || 'RESTART', cx, by + btnH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    hitRegions.push({
      x: bx, y: by, w: btnW, h: btnH,
      action: 'restart', data: null,
    });

    if (multiplayer) {
      const mpW = btnW;
      const mpH = 28;
      const mpX = cx - mpW / 2;
      const mpY = by - mpH - 8;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mpX, mpY, mpW, mpH, 6);
      else ctx.rect(mpX, mpY, mpW, mpH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MULTIPLAYER', cx, mpY + mpH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      hitRegions.push({
        x: mpX, y: mpY, w: mpW, h: mpH,
        action: 'multiplayer', data: null,
      });
    }
  }

}

function drawGiftIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#cc1f1f';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(-10, -6, 20, 14);
  ctx.strokeRect(-10, -6, 20, 14);
  ctx.fillStyle = '#ffd400';
  ctx.fillRect(-2, -6, 4, 14);
  ctx.fillRect(-10, -2, 20, 3);
  ctx.beginPath();
  ctx.ellipse(-4, -8, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(4, -8, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(-4, -8, 3, 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(4, -8, 3, 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
