import {
  drawTreeLarge, drawTreeSmall, drawMogul, drawRock, drawStump,
  drawPlayer, drawYeti,
} from './sprites.js';

const SPRITE_FNS = {
  treeLarge: drawTreeLarge,
  treeSmall: drawTreeSmall,
  mogul: drawMogul,
  rock: drawRock,
  stump: drawStump,
};

export function render(ctx, viewport, game) {
  const { player, world, yeti, state, score, highScore } = game;

  // Stage progression: every 1000m the snow gets darker. After stage 5, the
  // background is black and we invert the whole scene for a "night mode" feel.
  const stage = Math.floor(score / 1000);
  const inverted = stage >= 5;
  let bg;
  if (inverted) {
    bg = '#000000';
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

  // Player.
  ctx.save();
  ctx.translate(player.x - camX, player.y - camY);
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

  // State overlays.
  if (state === 'title') {
    drawCenteredPanel(ctx, viewport, {
      title: 'SKI FREE',
      lines: ['avoid trees. outrun the yeti.', '', game.controlHint],
      leaderboard: game.leaderboard,
    });
  } else if (state === 'gameover') {
    drawCenteredPanel(ctx, viewport, {
      title: 'GAME OVER',
      lines: [`${Math.floor(score)} m`, '', game.controlHint],
      leaderboard: game.leaderboard,
    });
  }
}

function drawCenteredPanel(ctx, viewport, panel) {
  const { title, lines, leaderboard } = panel;
  const lbRows = leaderboard ? Math.min(10, leaderboard.length) : 0;
  const lbHeight = leaderboard ? 28 + lbRows * 18 : 0;

  const cx = viewport.w / 2;
  const cy = viewport.h / 2;
  const w = Math.min(viewport.w - 40, 360);
  const h = 90 + lines.length * 22 + lbHeight + 30;

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

  ctx.font = '15px -apple-system, system-ui, sans-serif';
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += 22;
  }

  if (leaderboard) {
    y += 8;
    ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
    ctx.fillText('TOP 10', cx, y);
    y += 18;
    ctx.font = '13px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    const colLeft = cx - w/2 + 24;
    const colRight = cx + w/2 - 24;
    for (let i = 0; i < lbRows; i++) {
      const row = leaderboard[i];
      const rank = String(i + 1).padStart(2, ' ');
      const name = (row.name || 'anon').slice(0, 14);
      const sc = `${row.score} m`;
      ctx.fillText(`${rank}. ${name}`, colLeft, y);
      ctx.textAlign = 'right';
      ctx.fillText(sc, colRight, y);
      ctx.textAlign = 'left';
      y += 18;
    }
    if (lbRows === 0) {
      ctx.textAlign = 'center';
      ctx.fillText('be the first!', cx, y);
    }
    ctx.textAlign = 'center';
  }
}
