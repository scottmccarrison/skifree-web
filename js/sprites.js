// Procedural sprite drawing. World units; (0,0) at sprite center.

export function drawTreeLarge(ctx, score = 0) {
  ctx.fillStyle = '#1f5f2a';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(14, 6);
  ctx.lineTo(-14, 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(18, 14);
  ctx.lineTo(-18, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(-2, 14, 4, 6);
  // Christmas lights: only appear once you've earned them (>=500m).
  if (score >= 500) {
    const lights = [
      { x: -10, y: -2,  c: '#ff3838' },
      { x:  8,  y: -6,  c: '#ffd400' },
      { x: -4,  y: -14, c: '#3aa0ff' },
      { x:  10, y:  8,  c: '#39e08a' },
      { x: -12, y: 10,  c: '#ffd400' },
      { x:  4,  y: 4,   c: '#ff3838' },
    ];
    for (const l of lights) {
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Star on top.
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  ctx.arc(0, -23, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTreeSmall(ctx, score = 0) {
  ctx.fillStyle = '#2a7a36';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(10, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(-1.5, 8, 3, 4);
  // A couple of lights, gated to >=500m like the large tree.
  if (score >= 500) {
    ctx.fillStyle = '#ff3838';
    ctx.beginPath(); ctx.arc(-5, 2, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath(); ctx.arc(4, 5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3aa0ff';
    ctx.beginPath(); ctx.arc(0, -6, 1.3, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawMogul(ctx) {
  // Half-moon bump: lit top half + shaded base, reads as a 3D mound rather
  // than a flat puddle.
  ctx.fillStyle = '#f4faff';
  ctx.beginPath();
  ctx.arc(0, 2, 14, Math.PI, 2 * Math.PI);
  ctx.lineTo(-14, 2);
  ctx.closePath();
  ctx.fill();
  // Shaded base lip
  ctx.fillStyle = '#a8c0d4';
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.strokeStyle = '#6f8aa0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 2, 14, Math.PI, 2 * Math.PI);
  ctx.stroke();
  // Highlight streak
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 2, 10, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();
}

export function drawRock(ctx) {
  ctx.fillStyle = '#7a7a7a';
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.lineTo(-6, -8);
  ctx.lineTo(4, -10);
  ctx.lineTo(11, -2);
  ctx.lineTo(8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3f3f3f';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawJump(ctx) {
  // Simple log laid across the slope.
  ctx.fillStyle = '#7a4a1f';
  ctx.fillRect(-18, -5, 36, 10);
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-18, -5, 36, 10);
  // End grain caps.
  ctx.fillStyle = '#a36a32';
  ctx.fillRect(-18, -5, 4, 10);
  ctx.fillRect(14, -5, 4, 10);
  ctx.strokeRect(-18, -5, 4, 10);
  ctx.strokeRect(14, -5, 4, 10);
}

export function drawStump(ctx) {
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.stroke();
}

// Player sprite. `state`: 'straight' | 'leftEasy' | 'leftHard' | 'rightEasy' | 'rightHard' | 'crashed'
export function drawPlayer(ctx, state) {
  if (state === 'crashed') {
    drawCrashedPlayer(ctx);
    return;
  }
  const skiAngle = {
    straight: 0,
    leftEasy: 0.25,
    leftHard: 0.7,
    rightEasy: -0.25,
    rightHard: -0.7,
  }[state] ?? 0;

  // Skis.
  ctx.save();
  ctx.rotate(skiAngle);
  ctx.fillStyle = '#222';
  ctx.fillRect(-9, -2, 6, 18);
  ctx.fillRect(3, -2, 6, 18);
  ctx.restore();

  // Body.
  ctx.fillStyle = '#d33';
  ctx.beginPath();
  ctx.ellipse(0, -8, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(0, -19, 5, 0, Math.PI * 2);
  ctx.fill();

  // Hat.
  ctx.fillStyle = '#1144aa';
  ctx.fillRect(-5, -24, 10, 4);
}

function drawCrashedPlayer(ctx) {
  ctx.fillStyle = '#222';
  ctx.save();
  ctx.rotate(0.6);
  ctx.fillRect(-12, -2, 8, 4);
  ctx.restore();
  ctx.save();
  ctx.rotate(-0.4);
  ctx.fillRect(2, -2, 10, 4);
  ctx.restore();
  ctx.fillStyle = '#d33';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(8, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  // Stars.
  ctx.fillStyle = '#ffd400';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('★', -16, -10);
  ctx.fillText('★', 8, -14);
}

export function drawYeti(ctx) {
  // Body.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head.
  ctx.beginPath();
  ctx.arc(0, -18, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eyes.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-4, -20, 2, 2);
  ctx.fillRect(2, -20, 2, 2);
  // Mouth (fangs).
  ctx.fillStyle = '#aa0000';
  ctx.fillRect(-4, -14, 8, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-3, -14, 1, 2);
  ctx.fillRect(2, -14, 1, 2);
  // Arms.
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(-15, -2, 4, 8, 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(15, -2, 4, 8, -0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Santa hat.
  ctx.fillStyle = '#cc1f1f';
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(-9, -25);
  ctx.lineTo(9, -25);
  ctx.lineTo(6, -34);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // White brim.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -25, 10, 2, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Pom.
  ctx.beginPath();
  ctx.arc(6, -34, 2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}
