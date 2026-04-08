// Catalog of cosmetic items. Each entry is a self-contained record describing
// how the player sprite should be modified when this cosmetic is equipped.
//
// Slots:
//   'hat'       - drawHat(ctx) replaces the default blue rectangle hat
//   'jacket'    - bodyColor overrides the body fill; optional drawOverlay
//                 paints a pattern on top of the colored body
//   'accessory' - draw(ctx) is called AFTER the base sprite, sits on top
//                 (optional drawBehind for items that should sit beneath
//                 the body, like cape/wings)
//   'skis'      - skiColor overrides the default dark ski color
//
// Coordinate convention matches sprites.js drawPlayer:
//   y = -34..-22 = above the head (hats)
//   y = -19      = head center
//   y = -8       = body center
//   y = +7       = ski tops
//
// Adding a new cosmetic: drop a new entry into COSMETICS, add the id to
// CATALOG_ORDER, and define an achievement in achievements.js that unlocks it.

export const COSMETICS = {
  lift_pass: {
    id: 'lift_pass', name: 'Lift Pass', type: 'accessory',
    draw(ctx) {
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-3,-15); ctx.lineTo(-3,-9);
      ctx.moveTo(3,-15); ctx.lineTo(3,-9); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-3,-9,6,3);
      ctx.strokeRect(-3,-9,6,3);
    },
  },
  dunce_cap: {
    id: 'dunce_cap', name: 'Dunce Cap', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0,-32); ctx.lineTo(-6,-22); ctx.lineTo(6,-22); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#cc1f1f';
      ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('D', 0, -25);
    },
  },
  roadrunner_sneakers: {
    id: 'roadrunner_sneakers', name: 'Roadrunner Sneakers', type: 'skis',
    skiColor: '#cc1f1f',
  },
  blinders: {
    id: 'blinders', name: 'Blinders', type: 'hat',
    drawHat(ctx) {
      // Standard blue cap + black side flaps
      ctx.fillStyle = '#1144aa'; ctx.fillRect(-5,-24,10,4);
      ctx.fillStyle = '#222';
      ctx.fillRect(-7,-22,2,5); ctx.fillRect(5,-22,2,5);
    },
  },
  tinfoil_hat: {
    id: 'tinfoil_hat', name: 'Tinfoil Hat', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#cccccc'; ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0,-30); ctx.lineTo(-6,-22); ctx.lineTo(6,-22); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-2,-26); ctx.lineTo(1,-29); ctx.stroke();
    },
  },
  red_beanie: {
    id: 'red_beanie', name: 'Red Beanie', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#cc1f1f'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0,-22,6,Math.PI,0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0,-29,1.5,0,Math.PI*2); ctx.fill();
    },
  },
  sunglasses: {
    id: 'sunglasses', name: 'Sunglasses', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-5,-20,4,2); ctx.fillRect(1,-20,4,2);
      ctx.fillRect(-1,-19,2,1);
    },
  },
  headlamp: {
    id: 'headlamp', name: 'Headlamp', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#ffd400';
      ctx.beginPath(); ctx.arc(0,-25,1.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,153,0.4)';
      ctx.beginPath();
      ctx.moveTo(0,-25); ctx.lineTo(-8,-32); ctx.lineTo(8,-32); ctx.closePath();
      ctx.fill();
    },
  },
  gold_goggles: {
    id: 'gold_goggles', name: 'Gold Goggles', type: 'accessory',
    draw(ctx) {
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-3,-19,2.5,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(3,-19,2.5,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1,-19); ctx.lineTo(1,-19); ctx.stroke();
      ctx.fillStyle = '#ffd400'; ctx.fillRect(-5,-22,10,1);
    },
  },
  racing_stripes: {
    id: 'racing_stripes', name: 'Racing Stripes', type: 'jacket',
    bodyColor: '#1a1a1a',
    drawOverlay(ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.2,-15,1,12);
      ctx.fillRect(0.2,-15,1,12);
    },
  },
  yeti_plushie: {
    id: 'yeti_plushie', name: 'Yeti Plushie', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(8,-12,2.2,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(7,-13,0.8,0.8); ctx.fillRect(8.5,-13,0.8,0.8);
    },
  },
  cape: {
    id: 'cape', name: 'Cape', type: 'accessory',
    drawBehind(ctx) {
      ctx.fillStyle = '#cc1f1f'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-7,-15); ctx.lineTo(7,-15); ctx.lineTo(9,4); ctx.lineTo(-9,4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    },
  },
  knee_pads: {
    id: 'knee_pads', name: 'Knee Pads', type: 'jacket',
    bodyColor: '#d33',
    drawOverlay(ctx) {
      // Pads sit just below the body where legs would be
      ctx.fillStyle = '#888'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.4;
      ctx.fillRect(-5,1,3,3); ctx.strokeRect(-5,1,3,3);
      ctx.fillRect(2,1,3,3); ctx.strokeRect(2,1,3,3);
    },
  },
  acorn: {
    id: 'acorn', name: 'Acorn', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#7a4a1f';
      ctx.beginPath(); ctx.ellipse(8,-5,2,2.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a2410'; ctx.fillRect(7,-8,2,1.2);
    },
  },
  head_bandage: {
    id: 'head_bandage', name: 'Head Bandage', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
      ctx.fillRect(-6,-22,12,3); ctx.strokeRect(-6,-22,12,3);
      ctx.fillStyle = '#cc1f1f';
      ctx.beginPath(); ctx.arc(2,-20.5,1,0,Math.PI*2); ctx.fill();
    },
  },
  hot_pink_jacket: {
    id: 'hot_pink_jacket', name: 'Hot Pink Jacket', type: 'jacket',
    bodyColor: '#ff66bb',
  },
  sweatband: {
    id: 'sweatband', name: 'Sweatband', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
      ctx.fillRect(-5,-21,10,2); ctx.strokeRect(-5,-21,10,2);
      ctx.fillStyle = '#cc1f1f';
      ctx.fillRect(-1,-21,2,2);
    },
  },
  pajamas: {
    id: 'pajamas', name: 'Pajamas', type: 'jacket',
    bodyColor: '#88ccff',
    drawOverlay(ctx) {
      ctx.fillStyle = '#fff';
      const dots = [[-3,-12],[3,-10],[-2,-5],[3,-3],[-4,-2]];
      for (const [x,y] of dots) {
        ctx.beginPath(); ctx.arc(x,y,0.8,0,Math.PI*2); ctx.fill();
      }
    },
  },
  hawaiian_shirt: {
    id: 'hawaiian_shirt', name: 'Hawaiian Shirt', type: 'jacket',
    bodyColor: '#39e08a',
    drawOverlay(ctx) {
      ctx.fillStyle = '#cc1f1f';
      const flowers = [[-3,-10],[3,-5],[-2,-3]];
      for (const [x,y] of flowers) {
        ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#ffd400';
      for (const [x,y] of flowers) {
        ctx.beginPath(); ctx.arc(x,y,0.4,0,Math.PI*2); ctx.fill();
      }
    },
  },
  comeback_crown: {
    id: 'comeback_crown', name: 'Comeback Crown', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-5,-22); ctx.lineTo(-5,-26); ctx.lineTo(-2,-24); ctx.lineTo(0,-27);
      ctx.lineTo(2,-24); ctx.lineTo(5,-26); ctx.lineTo(5,-22); ctx.closePath();
      ctx.fill(); ctx.stroke();
    },
  },
  real_crown: {
    id: 'real_crown', name: 'Real Crown', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7,-22); ctx.lineTo(-7,-29); ctx.lineTo(-3,-25); ctx.lineTo(0,-31);
      ctx.lineTo(3,-25); ctx.lineTo(7,-29); ctx.lineTo(7,-22); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#cc1f1f';
      ctx.beginPath(); ctx.arc(0,-25,1,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3aa0ff';
      ctx.beginPath(); ctx.arc(-3.5,-24,0.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#39e08a';
      ctx.beginPath(); ctx.arc(3.5,-24,0.8,0,Math.PI*2); ctx.fill();
    },
  },
  centurion_stripes: {
    id: 'centurion_stripes', name: '100 Stripes', type: 'jacket',
    bodyColor: '#d33',
    drawOverlay(ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6,-11,12,1);
      ctx.fillRect(-6,-7,12,1);
      ctx.fillRect(-6,-3,12,1);
    },
  },
  wings: {
    id: 'wings', name: 'Wings', type: 'accessory',
    drawBehind(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.ellipse(-10,-9,4,7,0.3,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(10,-9,4,7,-0.3,0,Math.PI*2); ctx.fill(); ctx.stroke();
    },
  },
  cat_ears: {
    id: 'cat_ears', name: 'Cat Ears', type: 'hat',
    drawHat(ctx) {
      // Standard blue cap with two triangular ears
      ctx.fillStyle = '#1144aa'; ctx.fillRect(-5,-24,10,4);
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.moveTo(-5,-24); ctx.lineTo(-3,-29); ctx.lineTo(-1,-24);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1,-24); ctx.lineTo(3,-29); ctx.lineTo(5,-24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffaaaa';
      ctx.beginPath(); ctx.moveTo(-4,-25); ctx.lineTo(-3,-27); ctx.lineTo(-2,-25);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2,-25); ctx.lineTo(3,-27); ctx.lineTo(4,-25);
      ctx.closePath(); ctx.fill();
    },
  },
  monk_robe: {
    id: 'monk_robe', name: 'Monk Robe', type: 'jacket',
    bodyColor: '#cc7733',
  },
  apron: {
    id: 'apron', name: 'Apron', type: 'jacket',
    bodyColor: '#d33',
    drawOverlay(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.4;
      ctx.fillRect(-4,-10,8,9); ctx.strokeRect(-4,-10,8,9);
      ctx.fillRect(-4,-13,1,3); ctx.fillRect(3,-13,1,3);
    },
  },
  phoenix_patch: {
    id: 'phoenix_patch', name: 'Phoenix Patch', type: 'jacket',
    bodyColor: '#d33',
    drawOverlay(ctx) {
      ctx.fillStyle = '#ff8833';
      ctx.beginPath();
      ctx.moveTo(0,-4); ctx.lineTo(-2.5,1); ctx.lineTo(0,-1); ctx.lineTo(2.5,1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd400';
      ctx.beginPath(); ctx.arc(0,-1,0.8,0,Math.PI*2); ctx.fill();
    },
  },
  coffee_cup: {
    id: 'coffee_cup', name: 'Coffee Cup', type: 'accessory',
    draw(ctx) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
      ctx.fillRect(7,-10,3,4); ctx.strokeRect(7,-10,3,4);
      ctx.fillStyle = '#7a4a1f';
      ctx.fillRect(7.5,-9.5,2,1);
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(8.5,-12); ctx.quadraticCurveTo(9.5,-13,8.8,-15);
      ctx.stroke();
    },
  },
  daily_crown: {
    id: 'daily_crown', name: 'Daily Crown', type: 'hat',
    drawHat(ctx) {
      ctx.fillStyle = '#cccccc'; ctx.strokeStyle = '#666'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-5,-22); ctx.lineTo(-5,-26); ctx.lineTo(-2,-24); ctx.lineTo(0,-27);
      ctx.lineTo(2,-24); ctx.lineTo(5,-26); ctx.lineTo(5,-22); ctx.closePath();
      ctx.fill(); ctx.stroke();
    },
  },
  halo: {
    id: 'halo', name: 'Halo', type: 'accessory',
    draw(ctx) {
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0,-28,8,2.5,0,0,Math.PI*2); ctx.stroke();
      // soft glow
      ctx.strokeStyle = 'rgba(255,212,0,0.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0,-28,8,2.5,0,0,Math.PI*2); ctx.stroke();
    },
  },
};

// Display order for the wardrobe grid. Mirrors the achievement table so
// related items cluster together visually.
export const CATALOG_ORDER = [
  'lift_pass', 'dunce_cap', 'roadrunner_sneakers', 'blinders', 'tinfoil_hat',
  'red_beanie', 'sunglasses', 'headlamp', 'gold_goggles', 'racing_stripes',
  'yeti_plushie', 'cape', 'knee_pads', 'acorn', 'head_bandage',
  'hot_pink_jacket', 'sweatband', 'pajamas', 'hawaiian_shirt', 'comeback_crown',
  'real_crown', 'centurion_stripes', 'wings', 'cat_ears', 'monk_robe',
  'apron', 'phoenix_patch', 'coffee_cup', 'daily_crown', 'halo',
];
