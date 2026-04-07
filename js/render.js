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

  // Background.
  ctx.fillStyle = '#f4faff';
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

  // HUD.
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 18px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(score)} m`, 16, 28);
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  ctx.fillText(`best: ${Math.floor(highScore)} m`, 16, 46);

  // State overlays.
  if (state === 'title') {
    drawCenteredPanel(ctx, viewport, [
      'SKI FREE',
      '',
      'avoid trees. outrun the yeti.',
      '',
      game.controlHint,
    ]);
  } else if (state === 'gameover') {
    drawCenteredPanel(ctx, viewport, [
      'GAME OVER',
      '',
      `${Math.floor(score)} m`,
      '',
      game.controlHint,
    ]);
  }
}

function drawCenteredPanel(ctx, viewport, lines) {
  const cx = viewport.w / 2;
  const cy = viewport.h / 2;
  const w = Math.min(viewport.w - 40, 360);
  const h = 200;
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
  let y = cy - h/2 + 40;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) {
      ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
    } else {
      ctx.font = '15px -apple-system, system-ui, sans-serif';
    }
    ctx.fillText(line, cx, y);
    y += i === 0 ? 32 : 22;
  }
}
