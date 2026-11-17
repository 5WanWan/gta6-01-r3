// combat.js — shooting, punching, bullets, wanted level and police heat.
import { distance, angleTo, clamp } from './rng.js';
import { hitsBuilding } from './city.js';

export function makeBullets() { return []; }

export function fireBullet(bullets, x, y, angle, fromPlayer, speed) {
  bullets.push({
    x, y, angle, fromPlayer: !!fromPlayer,
    speed: speed || 780, life: 1.1, damage: fromPlayer ? 34 : 12,
  });
}

export function updateBullets(bullets, dt, city, player, enemies, peds, cars, onHit) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && hitsBuilding(city, b.x, b.y, 2)) dead = true;
    if (!dead && b.fromPlayer) {
      for (const e of enemies) {
        if (e.alive && distance(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= b.damage;
          if (e.hp <= 0) { e.alive = false; if (onHit) onHit('enemy-killed', e); }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const car of cars) {
        if (distance(b.x, b.y, car.x, car.y) < 24) {
          car.damage += 1;
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      const px = player.inCar ? player.inCar.x : player.x;
      const py = player.inCar ? player.inCar.y : player.y;
      if (distance(b.x, b.y, px, py) < (player.inCar ? 26 : 14)) {
        damagePlayer(player, b.damage);
        if (onHit) onHit('player-hit', null);
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

export function damagePlayer(player, amount) {
  if (player.hurtTimer > 0) return;
  player.hp = Math.max(0, player.hp - amount);
  player.hurtTimer = 0.5;
}

// Melee: a punch hits the nearest enemy or pedestrian in front.
export function punch(player, enemies, peds, onHit) {
  if (player.punchTimer > 0) return false;
  player.punchTimer = 0.45;
  const px = player.x + Math.cos(player.angle) * 26;
  const py = player.y + Math.sin(player.angle) * 26;
  for (const e of enemies) {
    if (e.alive && distance(px, py, e.x, e.y) < 30) {
      e.hp -= 25;
      if (e.hp <= 0) { e.alive = false; if (onHit) onHit('enemy-killed', e); }
      return true;
    }
  }
  for (const p of peds) {
    if (distance(px, py, p.x, p.y) < 28) {
      p.panic = 3;
      if (onHit) onHit('ped-punched', p);
      return true;
    }
  }
  return false;
}

// Wanted level 0-5. Crimes raise it; laying low lowers it.
export function raiseWanted(player, stars) {
  player.wanted = clamp(player.wanted + stars, 0, 5);
  player.wantedTimer = 0;
}

export function wantedDecay(player, dt, inPursuit) {
  if (player.wanted === 0) return;
  if (inPursuit) { player.wantedTimer = 0; return; }
  player.wantedTimer += dt;
  const coolOff = [0, 25, 40, 60, 90, 120][player.wanted];
  if (player.wantedTimer > coolOff) {
    player.wanted -= 1;
    player.wantedTimer = 0;
  }
}

// How many police cars the current wanted level calls for.
export function policeWantedCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted];
}

// A police ram hurts the player and their car.
export function policeRamDamage(player) {
  if (player.inCar) {
    player.inCar.damage += 1;
    damagePlayer(player, 4);
  } else {
    damagePlayer(player, 8);
  }
}
