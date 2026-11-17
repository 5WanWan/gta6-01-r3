// hud.js — the heads-up display: health, cash, wanted stars, mission
// objective, weapon, timer, event feed, radio chatter and the minimap.
import { WORLD, DISTRICTS } from './city.js';
import { clamp } from './rng.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 18, 32, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, W, H, state, now) {
  const p = state.player;
  const ms = state.mission;
  const m = state.missionDef;

  // --- Top-left: health, cash, weapon.
  panel(ctx, 12, 12, 250, 86);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('DARIO VOSS', 24, 32);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 40, 180, 12);
  ctx.fillStyle = p.hp > 50 ? '#2ecc71' : p.hp > 25 ? '#f2c230' : '#e83a3a';
  ctx.fillRect(24, 40, 180 * clamp(p.hp / p.maxHp, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Verdana';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 210, 51);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 15px Verdana';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 24, 74);
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '12px Verdana';
  const weaponLabel = p.inCar ? `${p.inCar.def.name}` : (p.weapon === 'pistol' ? `PISTOL  ${p.ammo} bullets` : 'FISTS');
  ctx.fillText(weaponLabel, 24, 90);
  if (p.inCar) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(`SPEED ${Math.round(Math.abs(p.inCar.speed) * 0.9)} mph`, 150, 90);
  }

  // --- Top-right: wanted stars.
  panel(ctx, W - 218, 12, 206, 78);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Verdana';
  ctx.fillText('WANTED', W - 206, 32);
  for (let i = 0; i < 5; i++) {
    ctx.font = '22px Verdana';
    ctx.fillStyle = i < p.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 200 + i * 36, 56);
  }
  if (p.wanted > 0) {
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 11px Verdana';
    ctx.fillText(p.wanted >= 3 ? 'SOLMAR PD IN PURSUIT' : 'POLICE ALERTED', W - 206, 76);
  }

  // --- Top-centre: mission objective + timer.
  if (m && (ms.status === 'active' || ms.status === 'briefing')) {
    const text = ms.status === 'briefing' ? 'NEW MISSION — press ENTER to start' : m.objectiveShort;
    ctx.font = 'bold 13px Verdana';
    const w = ctx.measureText(text).width + 32;
    panel(ctx, W / 2 - w / 2, 12, w, 30);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, 32);
    ctx.textAlign = 'left';
    if (m.timeLimit > 0 && ms.status === 'active') {
      const t = Math.max(0, Math.ceil(ms.timer));
      ctx.font = 'bold 13px Verdana';
      ctx.fillStyle = t < 30 ? '#ff6a5a' : '#fff';
      const tw = ctx.measureText(`⏱ ${t}s`).width + 20;
      panel(ctx, W / 2 - tw / 2, 48, tw, 24);
      ctx.fillStyle = t < 30 ? '#ff6a5a' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱ ${t}s`, W / 2, 65);
      ctx.textAlign = 'left';
    }
  }

  // --- Bottom-left: event feed + radio chatter.
  const feed = state.feed.slice(-5);
  let fy = H - 24 - feed.length * 18;
  ctx.font = '12px Verdana';
  ctx.textAlign = 'left';
  for (const line of feed) {
    const w = ctx.measureText(line).width + 14;
    ctx.fillStyle = 'rgba(8, 18, 32, 0.6)';
    ctx.beginPath(); ctx.roundRect(12, fy - 13, w, 17, 4); ctx.fill();
    ctx.fillStyle = '#d8ecff';
    ctx.fillText(line, 19, fy);
    fy += 18;
  }
  if (state.radio) {
    ctx.font = 'italic 12px Verdana';
    const w = ctx.measureText(state.radio).width + 14;
    ctx.fillStyle = 'rgba(120, 30, 30, 0.65)';
    ctx.beginPath(); ctx.roundRect(12, H - 150, w, 18, 4); ctx.fill();
    ctx.fillStyle = '#ffd9d9';
    ctx.fillText(state.radio, 19, H - 137);
  }

  // --- Bottom-right: minimap with district labels.
  drawMinimap(ctx, W - 212, H - 212, 200, 200, state);

  // --- District name under the minimap.
  ctx.fillStyle = 'rgba(8, 18, 32, 0.72)';
  ctx.beginPath(); ctx.roundRect(W - 212, H - 232, 200, 18, 4); ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText(state.districtName, W - 112, H - 219);
  ctx.textAlign = 'left';

  // --- Controls reminder (fades after the first minute).
  if (state.playTime < 60) {
    ctx.fillStyle = 'rgba(8,18,32,0.6)';
    ctx.font = '11px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move · E enter/steal car · Click shoot · Space punch · P pause · F save at garage', W / 2, H - 8);
    ctx.textAlign = 'left';
  }

  // --- Mission banner (MISSION PASSED / FAILED).
  if (ms.banner && ms.banner.t > 0) {
    const a = clamp(ms.banner.t, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,18,32,0.8)';
    ctx.fillRect(0, H / 2 - 70, W, 110);
    ctx.fillStyle = ms.banner.text.includes('FAILED') ? '#ff6a5a' : '#7dff8a';
    ctx.font = 'bold 42px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(ms.banner.text, W / 2, H / 2 - 8);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Verdana';
    ctx.fillText(ms.banner.sub, W / 2, H / 2 + 26);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function drawMinimap(ctx, x, y, w, h, state) {
  const scale = w / WORLD;
  ctx.fillStyle = 'rgba(8, 18, 32, 0.8)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  // Water + beach.
  ctx.fillStyle = '#2f9fd8';
  ctx.fillRect(x, y + (WORLD - 170) * scale, w, 170 * scale);
  ctx.fillStyle = '#f0d896';
  ctx.fillRect(x, y + (WORLD - 260) * scale, w, 90 * scale);
  // Grass.
  ctx.fillStyle = '#79c94f';
  ctx.fillRect(x, y, w, (WORLD - 260) * scale);
  // Roads.
  ctx.strokeStyle = '#3c4148';
  ctx.lineWidth = 3;
  for (const rx of state.city.roadsX) {
    ctx.beginPath(); ctx.moveTo(x + rx * scale, y); ctx.lineTo(x + rx * scale, y + h); ctx.stroke();
  }
  for (const ry of state.city.roadsY) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * scale); ctx.lineTo(x + w, y + ry * scale); ctx.stroke();
  }
  // District labels, clamped inside the minimap so none clips at an edge.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px Verdana';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const lx = clamp(x + d.x * scale, x + 34, x + w - 34);
    const ly = clamp(y + d.y * scale, y + 10, y + h - 6);
    ctx.fillText(d.name, lx, ly);
  }
  // Mission target.
  if (state.target) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(x + state.target.x * scale, y + state.target.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Save point.
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x + state.city.spots.savePoint.x * scale - 3, y + state.city.spots.savePoint.y * scale - 3, 6, 6);
  // Police (red dots), traffic (white), player (green arrow).
  for (const car of state.cars) {
    if (car.type === 'police') {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath(); ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#7dff8a';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = '#cfe8ff';
  ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BAY', x + w / 2, y - 6);
  ctx.textAlign = 'left';
}

export function drawDialogue(ctx, W, H, lines, index) {
  const line = lines[index] || '';
  const boxH = 110;
  ctx.fillStyle = 'rgba(8, 18, 32, 0.88)';
  ctx.beginPath(); ctx.roundRect(90, H - boxH - 30, W - 180, boxH, 10); ctx.fill();
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 13px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('STORY', 110, H - boxH + 2);
  ctx.fillStyle = '#fff';
  ctx.font = '15px Verdana';
  wrapText(ctx, line, 110, H - boxH + 26, W - 220, 20);
  ctx.fillStyle = '#9fc4e8';
  ctx.font = '12px Verdana';
  ctx.textAlign = 'right';
  ctx.fillText(`ENTER to continue  (${index + 1}/${lines.length})`, W - 110, H - 42);
  ctx.textAlign = 'left';
}

export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function drawStartScreen(ctx, W, H, state, now) {
  // Sun-soaked title card over a dimmed city.
  ctx.fillStyle = 'rgba(6, 16, 32, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const pulse = 1 + Math.sin(now / 500) * 0.02;
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 74px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BAY', 0, 0);
  ctx.fillStyle = '#ff6a5a';
  ctx.font = 'bold 30px Verdana';
  ctx.fillText('★ STREETS OF THE SUN ★', 0, 44);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '17px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('An open-world crime story. Steal cars. Outrun the law. Pay off the debt.', W / 2, 250);
  ctx.fillText('Three missions. One city. No mercy — except yours.', W / 2, 278);
  ctx.font = 'bold 15px Verdana';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(state.hasSave ? '▶  ENTER — Continue your story (save found)' : '▶  ENTER — Start the story', W / 2, 330);
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '14px Verdana';
  const controls = [
    'WASD / Arrows — move & drive      E — enter / steal a car',
    'Mouse — aim      Click — shoot pistol      Space — punch',
    'Shift — run      F — save at the garage      P — pause      M — mute',
  ];
  controls.forEach((c, i) => ctx.fillText(c, W / 2, 380 + i * 24));
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 13px Verdana';
  ctx.fillText('A complete open world: traffic, pedestrians, police, missions, combat, wanted stars, minimap & saves.', W / 2, 470);
  ctx.fillStyle = '#9fc4e8';
  ctx.font = '12px Verdana';
  ctx.fillText('Original game — city, characters and story made for this bounty. Nothing from any commercial game.', W / 2, 500);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, W, H) {
  ctx.fillStyle = 'rgba(6, 16, 32, 0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '16px Verdana';
  ctx.fillText('P to resume · F to save at the garage · M to mute', W / 2, H / 2 + 30);
  ctx.textAlign = 'left';
}

export function drawWasted(ctx, W, H, state) {
  ctx.fillStyle = 'rgba(20, 0, 0, 0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff6a5a';
  ctx.font = 'bold 64px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '17px Verdana';
  ctx.fillText('The Solmar PD scraped you off the asphalt. The hospital patched you up — for a fee.', W / 2, H / 2 + 20);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 16px Verdana';
  ctx.fillText('ENTER — get back on the street', W / 2, H / 2 + 60);
  ctx.textAlign = 'left';
}
