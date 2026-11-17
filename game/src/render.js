// render.js — draws everything: the city, cars, people, effects, HUD,
// minimap, dialogue, banners and menus. One canvas, bright day palette.
import { WORLD, BLOCK, ROAD_HALF, PALETTE, DISTRICTS, districtAt } from './city.js';
import { clamp } from './rng.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  return { ctx, W, H };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCity(ctx, city, cam) {
  const { x0, y0, x1, y1 } = cam;
  // Ground: grass everywhere.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Grass mowing stripes for texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 120;
  const startStripe = Math.floor(y0 / stripe) * stripe;
  for (let y = startStripe; y < y1; y += stripe * 2) {
    ctx.fillRect(x0, y, x1 - x0, stripe);
  }
  // Beach and water along the south edge.
  if (y1 > city.beach.y) {
    ctx.fillStyle = PALETTE.beach;
    ctx.fillRect(x0, Math.max(y0, city.beach.y), x1 - x0, city.beach.y + city.beach.h - Math.max(y0, city.beach.y));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, city.beach.y + 190), x1 - x0, y1 - Math.max(y0, city.beach.y + 190));
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(x0 / 260) * 260; x < x1; x += 260) {
      ctx.fillRect(x + 40, city.beach.y + 215, 120, 4);
      ctx.fillRect(x + 90, city.beach.y + 240, 90, 4);
    }
    // Umbrellas on the sand.
    ctx.fillStyle = '#e83a6a';
    for (let x = 300; x < WORLD; x += 420) {
      if (x < x0 - 40 || x > x1 + 40) continue;
      ctx.beginPath(); ctx.arc(x, city.beach.y + 90, 22, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f2d54b';
      ctx.fillRect(x - 2, city.beach.y + 90, 4, 26);
      ctx.fillStyle = '#e83a6a';
    }
  }
  // Sidewalk slabs around every block.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let bx = 0; bx < city.roadsX.length - 1; bx++) {
    for (let by = 0; by < city.roadsY.length - 1; by++) {
      const sx = city.roadsX[bx] + ROAD_HALF;
      const sy = city.roadsY[by] + ROAD_HALF;
      const sw = city.roadsX[bx + 1] - city.roadsX[bx] - ROAD_HALF * 2;
      const sh = city.roadsY[by + 1] - city.roadsY[by] - ROAD_HALF * 2;
      if (sx + sw < x0 || sx > x1 || sy + sh < y0 || sy > y1) continue;
      if (sy > city.beach.y - 20) continue;
      ctx.fillRect(sx, sy, sw, sh);
    }
  }
  // Roads: asphalt with edge lines and dashed centre lines.
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.roadsX) {
    if (rx + ROAD_HALF < x0 || rx - ROAD_HALF > x1) continue;
    ctx.fillRect(rx - ROAD_HALF, y0, ROAD_HALF * 2, y1 - y0);
  }
  for (const ry of city.roadsY) {
    if (ry + ROAD_HALF < y0 || ry - ROAD_HALF > y1) continue;
    ctx.fillRect(x0, ry - ROAD_HALF, x1 - x0, ROAD_HALF * 2);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = '#e8e4da';
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      if (rx < x0 - 60 || rx > x1 + 60 || ry < y0 - 60 || ry > y1 + 60) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx - ROAD_HALF + 6 + i * 13, ry - ROAD_HALF - 4, 7, 8);
        ctx.fillRect(rx - ROAD_HALF + 6 + i * 13, ry + ROAD_HALF - 4, 7, 8);
      }
    }
  }
  // Dashed centre lines.
  ctx.fillStyle = PALETTE.lane;
  for (const rx of city.roadsX) {
    if (rx < x0 - 10 || rx > x1 + 10) continue;
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of city.roadsY) {
    if (ry < y0 - 10 || ry > y1 + 10) continue;
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
  }
  // Parks: green circles are drawn as soft patches; trees below.
  // Buildings with roof colour, parapet and a sun shadow.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillRect(b.x, b.y, 8, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const rows = Math.max(1, Math.floor(b.h / 34));
    const cols = Math.max(1, Math.floor(b.w / 34));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(b.x + 14 + c * 34, b.y + 14 + r * 34, 14, 10);
      }
    }
    if (b.downtown) {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 16, 12, 32);
    }
  }
  // Trees and palms.
  for (const t of city.trees) {
    if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 10); ctx.lineTo(t.x, t.y - 8); ctx.stroke();
      ctx.fillStyle = '#2f9d4e';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * 12, t.y - 8 + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#2f9d4e';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57c465';
      ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawCar(ctx, car, now) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const { len, wid } = car.def;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 4, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.def.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Police livery.
  if (car.type === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-len / 2 + 8, -wid / 2, len - 16, wid);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-4, -wid / 2, 8, wid);
    // Light bar, alternating red/blue.
    const phase = Math.floor(now / 260) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-8, -wid / 2 - 3, 8, 5);
    ctx.fillStyle = phase ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(0, -wid / 2 - 3, 8, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  // Windows and roof.
  ctx.fillStyle = '#1d2f45';
  ctx.fillRect(-len / 2 + 10, -wid / 2 + 3, 12, wid - 6);
  ctx.fillRect(len / 2 - 22, -wid / 2 + 3, 12, wid - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-len / 2 + 10, -wid / 2 + 3, 12, 3);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#a02020';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 5);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 7, 3, 5);
  if (car.damage > 6) {
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, 10, 8);
  }
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, shirt, skin, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Legs (walking bob).
  const bob = o.walking ? Math.sin((o.walkPhase || 0)) * 3 : 0;
  ctx.fillStyle = o.pants || '#2c4a6e';
  ctx.fillRect(-6, -7 + bob, 5, 14);
  ctx.fillRect(-6, 1 - bob, 5, 14);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = o.hair || '#20242c';
  ctx.beginPath(); ctx.arc(6, -2, 5, Math.PI * 0.6, Math.PI * 1.7); ctx.fill();
  // Gun or fists.
  if (o.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  } else if (o.punching) {
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(16, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawBullet(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.fillStyle = '#ffe14d';
  ctx.fillRect(-7, -1.5, 14, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(4, -1, 4, 2);
  ctx.restore();
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawMarker(ctx, x, y, label, now, color) {
  const bob = Math.sin(now / 300) * 6;
  ctx.save();
  ctx.translate(x, y + bob - 30);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color || '#ffe14d';
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 2;
  ctx.fillRect(-11, -11, 22, 22);
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.restore();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.arc(x, y + bob - 8, 3, 0, Math.PI * 2); ctx.fill();
  if (label) {
    ctx.font = 'bold 12px Verdana';
    ctx.textAlign = 'center';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(10,20,35,0.85)';
    roundRect(ctx, x - w / 2, y + bob - 64, w, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(label, x, y + bob - 50);
  }
}

export function drawSavePoint(ctx, x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  const pulse = 1 + Math.sin(now / 400) * 0.12;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('S', 0, 8);
  ctx.font = 'bold 10px Verdana';
  ctx.fillText('SAVE', 0, 46);
  ctx.restore();
}

export function drawCashPickup(ctx, x, y, now) {
  const bob = Math.sin(now / 250) * 4;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(-13, -8, 26, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 4);
  ctx.restore();
}
