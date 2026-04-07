import {
  drawTreeLarge, drawTreeSmall, drawMogul, drawRock, drawStump, drawJump,
  drawPlayer, drawYeti,
} from './sprites.js';

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

export function render(ctx, viewport, game) {
  hitRegions.length = 0;
  const { player, world, yeti, state, score, highScore, deathCount } = game;

  // Stage progression: every 1000m the snow gets darker. After stage 5, the
  // background is black and we invert the whole scene for a "night mode" feel.
  const stage = Math.floor(score / 1000);
  const inverted = stage >= 5;
  let bg;
  if (inverted) {
    // White here - the difference-with-white pass below flips it (and the
    // sprites) to black-with-inverted-colors.
    bg = '#ffffff';
  } else {
    // 244 -> ~120 across 5 steps.
    const v = Math.max(120, 244 - stage * 25);
    bg = `rgb(${v}, ${v + 4}, ${v + 8})`;
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, viewport.w, viewport.h);

  // Camera: player drawn at ~1/3 from top, x centered.
  const camX = player.x - viewport.w / 2;
  const camY = player.y - viewport.h / 3;

  // Draw obstacles in view.
  for (const o of world.obstacles) {
    const sx = o.x - camX;
    const sy = o.y - camY;
    if (sx < -60 || sx > viewport.w + 60) continue;
    if (sy < -60 || sy > viewport.h + 60) continue;
    ctx.save();
    ctx.translate(sx, sy);
    SPRITE_FNS[o.type.kind](ctx);
    ctx.restore();
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
  ctx.save();
  ctx.translate(player.x - camX, player.y - camY - lift);
  drawPlayer(ctx, player.state);
  ctx.restore();

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

  // State overlays.
  if (state === 'title') {
    drawCenteredPanel(ctx, viewport, game, {
      title: 'SKI FREE',
      hint: game.hint,
      lines: ['', game.controlHint],
    });
  } else if (state === 'gameover') {
    drawCenteredPanel(ctx, viewport, game, {
      title: 'GAME OVER',
      hint: game.hint,
      lines: [`${Math.floor(score)} m`, '', game.controlHint],
    });
  }
}

function formatResetIn(ms) {
  if (ms <= 0) return 'resetting...';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `resets in ${h}h ${m}m`;
}

function drawCenteredPanel(ctx, viewport, game, panel) {
  const { title, hint, lines } = panel;
  const board = game.leaderboard;
  const tab = game.leaderboardTab || 'daily';

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
      rows = (game.personalBests || []).map(pb => ({
        name: 'you',
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
  const h = 90 + hintHeight + lines.length * 22 + lbHeight + 30;

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

  if (board) {
    y += 4;
    // Tabs.
    const tabs = [
      { key: 'daily',   label: 'DAILY' },
      { key: 'alltime', label: 'ALL TIME' },
      { key: 'you',     label: 'YOU' },
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
}
