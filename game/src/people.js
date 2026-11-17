// people.js — the player on foot, pedestrians with sidewalk strolls,
// and the rival crew that fights back in the story missions.
import { clamp, angleLerp, angleTo, distance, makeRng } from './rng.js';
import { hitsBuilding, WORLD, isOnRoad } from './city.js';

export const PLAYER_COLORS = { shirt: '#e83a3a', pants: '#2c4a6e', skin: '#e8b98a', hair: '#20242c' };

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, cash: 120, weapon: 'fists', ammo: 0,
    inCar: null, onFoot: true, run: false, punchTimer: 0, hurtTimer: 0,
    wanted: 0, wantedTimer: 0, kills: 0, carsStolen: 0, missionsDone: 0,
  };
}

export function makePedestrian(rng, city) {
  const onRoad = rng.chance(0.6);
  const x = onRoad ? city.roadsX[rng.int(0, city.roadsX.length - 1)] + rng.range(-50, 50) : rng.range(150, WORLD - 150);
  const y = onRoad ? rng.range(150, WORLD - 150) : city.roadsY[rng.int(0, city.roadsY.length - 1)] + rng.range(-50, 50);
  const shirts = ['#e8a13a', '#5a8fc9', '#7ec850', '#e86a8a', '#b06ac9', '#4ec9b0', '#d8d2c4', '#c95a4e'];
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
    shirt: rng.pick(shirts), skin: rng.pick(['#e8b98a', '#c98a5a', '#8a5a3a', '#f0d0a8']),
    state: 'stroll', panic: 0, waitTimer: rng.range(0, 4),
    targetX: x, targetY: y,
  };
}

export function makeEnemy(rng, x, y) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(70, 95),
    hp: 60, shirt: '#3a3a3a', skin: '#e8b98a', state: 'guard',
    shootTimer: rng.range(0.5, 1.5), alive: true,
  };
}

// The player on foot: WASD movement, sprint, building collision.
export function updatePlayerOnFoot(player, dt, input, city) {
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = mx !== 0 || my !== 0;
  const speed = input.run ? 235 : 150;
  if (moving) {
    const len = Math.hypot(mx, my);
    const nx = player.x + (mx / len) * speed * dt;
    const ny = player.y + (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
    if (!hitsBuilding(city, nx, player.y, 12)) player.x = nx;
    if (!hitsBuilding(city, player.x, ny, 12)) player.y = ny;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  player.x = clamp(player.x, 30, WORLD - 30);
  player.y = clamp(player.y, 30, WORLD - 30);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  return moving;
}

// Pedestrians stroll along sidewalks; gunfire or a speeding car near
// them makes them panic and run away.
export function updatePedestrian(ped, dt, city, dangerX, dangerY, dangerR) {
  if (ped.panic > 0) {
    ped.panic -= dt;
    const away = angleTo(dangerX, dangerY, ped.x, ped.y);
    ped.angle = angleLerp(ped.angle, away, Math.min(1, dt * 5));
    const nx = ped.x + Math.cos(ped.angle) * 150 * dt;
    const ny = ped.y + Math.sin(ped.angle) * 150 * dt;
    if (!hitsBuilding(city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
    return;
  }
  if (dangerX !== null && distance(ped.x, ped.y, dangerX, dangerY) < dangerR) {
    ped.panic = 2.5;
    return;
  }
  ped.waitTimer -= dt;
  if (ped.waitTimer <= 0) {
    ped.waitTimer = 3 + Math.random() * 5;
    // Pick a new stroll target near a road.
    const rx = city.roadsX[Math.floor(Math.random() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(Math.random() * city.roadsY.length)];
    ped.targetX = clamp(ped.x + (Math.random() - 0.5) * 500, 80, WORLD - 80);
    ped.targetY = clamp(ped.y + (Math.random() - 0.5) * 500, 80, WORLD - 80);
    if (Math.random() < 0.5) ped.targetX = rx + (Math.random() - 0.5) * 90;
    else ped.targetY = ry + (Math.random() - 0.5) * 90;
  }
  const d = distance(ped.x, ped.y, ped.targetX, ped.targetY);
  if (d > 12) {
    ped.angle = angleLerp(ped.angle, angleTo(ped.x, ped.y, ped.targetX, ped.targetY), Math.min(1, dt * 4));
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!hitsBuilding(city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
  }
}

// Enemies guard a spot, then chase and shoot the player once alerted.
export function updateEnemy(enemy, dt, player, city, onShoot) {
  if (!enemy.alive) return;
  const d = distance(enemy.x, enemy.y, player.x, player.y);
  if (d < 520) enemy.state = 'chase';
  if (enemy.state === 'chase') {
    enemy.angle = angleLerp(enemy.angle, angleTo(enemy.x, enemy.y, player.x, player.y), Math.min(1, dt * 5));
    if (d > 180) {
      const nx = enemy.x + Math.cos(enemy.angle) * enemy.speed * dt;
      const ny = enemy.y + Math.sin(enemy.angle) * enemy.speed * dt;
      if (!hitsBuilding(city, nx, ny, 12)) { enemy.x = nx; enemy.y = ny; }
    }
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && d < 480) {
      enemy.shootTimer = 1.1 + Math.random() * 0.9;
      if (onShoot) onShoot(enemy);
    }
  }
}

export function spawnPedestrians(city, rng, count, px, py) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = makePedestrian(rng, city);
    if (distance(p.x, p.y, px, py) < 260) continue;
    peds.push(p);
  }
  return peds;
}
