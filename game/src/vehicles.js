// vehicles.js — car types, traffic driving, police pursuit, stealing.
// Cars are plain data; the update functions move them along the road grid.
import { clamp, angleLerp, angleTo, distance, makeRng } from './rng.js';
import { isOnRoad, nearestRoadCoord, hitsBuilding, WORLD, ROAD_HALF } from './city.js';

export const CAR_TYPES = {
  sedan:   { name: 'Solmar Sedan',   color: '#e8e4da', topSpeed: 300, accel: 210, len: 46, wid: 22 },
  taxi:    { name: 'Sun Cab',        color: '#f2c230', topSpeed: 290, accel: 200, len: 46, wid: 22 },
  sports:  { name: 'Vortex GT',      color: '#e83a3a', topSpeed: 430, accel: 320, len: 48, wid: 22 },
  pickup:  { name: 'Rancho Pickup',  color: '#4a7ec9', topSpeed: 310, accel: 220, len: 52, wid: 24 },
  van:     { name: 'Cargo Van',      color: '#8a8f96', topSpeed: 250, accel: 160, len: 56, wid: 24 },
  police:  { name: 'Solmar PD Cruiser', color: '#20242c', topSpeed: 400, accel: 300, len: 48, wid: 22 },
  muscle:  { name: 'Bravado Muscle', color: '#7a2ea8', topSpeed: 380, accel: 290, len: 50, wid: 23 },
};

export function makeCar(rng, type, x, y, angle) {
  const def = CAR_TYPES[type];
  return {
    type, def, x, y, angle: angle || 0, speed: 0,
    driver: type === 'police' ? 'police' : 'traffic',
    parked: false, stolen: false, siren: type === 'police',
    // Traffic state: which road it follows and which way along it.
    axis: 'x', dir: 1, targetSpeed: rng.range(90, 150),
    honk: 0, brakeLight: false, damage: 0,
  };
}

export function spawnTrafficCar(city, rng, playerX, playerY) {
  const types = ['sedan', 'taxi', 'sports', 'pickup', 'van', 'muscle'];
  const type = rng.pick(types);
  // Pick a random road intersection away from the player.
  for (let tries = 0; tries < 20; tries++) {
    const rx = city.roadsX[rng.int(0, city.roadsX.length - 1)];
    const ry = city.roadsY[rng.int(0, city.roadsY.length - 1)];
    const onX = rng.chance(0.5);
    const x = onX ? rx + rng.range(-ROAD_HALF + 12, ROAD_HALF - 12) : rng.range(200, WORLD - 200);
    const y = onX ? rng.range(200, WORLD - 200) : ry + rng.range(-ROAD_HALF + 12, ROAD_HALF - 12);
    if (distance(x, y, playerX, playerY) < 500) continue;
    if (hitsBuilding(city, x, y, 30)) continue;
    const car = makeCar(rng, type, x, y, onX ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI));
    car.axis = onX ? 'y' : 'x';
    car.dir = rng.chance(0.5) ? 1 : -1;
    return car;
  }
  return null;
}

export function spawnParkedCar(city, rng, playerX, playerY) {
  const types = ['sedan', 'sports', 'pickup', 'muscle', 'taxi'];
  const type = rng.pick(types);
  for (let tries = 0; tries < 20; tries++) {
    const rx = city.roadsX[rng.int(0, city.roadsX.length - 1)];
    const ry = city.roadsY[rng.int(0, city.roadsY.length - 1)];
    const side = rng.chance(0.5) ? 1 : -1;
    const onX = rng.chance(0.5);
    const x = onX ? rx + side * (ROAD_HALF + 8) : rng.range(200, WORLD - 200);
    const y = onX ? rng.range(200, WORLD - 200) : ry + side * (ROAD_HALF + 8);
    if (distance(x, y, playerX, playerY) < 350) continue;
    if (hitsBuilding(city, x, y, 30)) continue;
    const car = makeCar(rng, type, x, y, onX ? Math.PI / 2 : 0);
    car.parked = true;
    car.driver = 'none';
    return car;
  }
  return null;
}

export function spawnPoliceCar(city, rng, playerX, playerY) {
  const car = makeCar(rng, 'police', 0, 0, 0);
  // Appear on a road a few hundred units from the player.
  const ang = rng.range(0, Math.PI * 2);
  const px = clamp(playerX + Math.cos(ang) * 620, 120, WORLD - 120);
  const py = clamp(playerY + Math.sin(ang) * 620, 120, WORLD - 120);
  const snap = { x: nearestRoadCoord(city, px), y: nearestRoadCoord(city, py) };
  car.x = Math.abs(px - snap.x) < Math.abs(py - snap.y) ? snap.x : px;
  car.y = Math.abs(px - snap.x) < Math.abs(py - snap.y) ? py : snap.y;
  car.angle = angleTo(car.x, car.y, playerX, playerY);
  return car;
}

// Traffic cars cruise their road, turn at intersections, and slow for
// cars ahead. They never leave the road grid.
export function updateTrafficCar(city, car, dt, cars) {
  if (car.parked || car.driver === 'police') return;
  const speedTarget = car.targetSpeed;
  let ahead = false;
  for (const other of cars) {
    if (other === car || other.parked) continue;
    const d = distance(car.x, car.y, other.x, other.y);
    if (d < 70) {
      const a = angleTo(car.x, car.y, other.x, other.y);
      let diff = Math.abs(a - car.angle) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.6) { ahead = true; break; }
    }
  }
  const want = ahead ? 0 : speedTarget;
  car.speed += clamp(want - car.speed, -260 * dt, 150 * dt);
  car.speed = clamp(car.speed, 0, speedTarget);
  car.brakeLight = ahead;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // At an intersection, sometimes turn onto the crossing road.
  const onXRoad = city.roadsX.some((r) => Math.abs(nx - r) < 6);
  const onYRoad = city.roadsY.some((r) => Math.abs(ny - r) < 6);
  if ((onXRoad || onYRoad) && Math.abs(car.speed) > 20) {
    const rngTurn = Math.random();
    if (rngTurn < 0.25) {
      if (car.axis === 'x' && onYRoad) { car.axis = 'y'; car.dir = Math.random() < 0.5 ? 1 : -1; }
      else if (car.axis === 'y' && onXRoad) { car.axis = 'x'; car.dir = Math.random() < 0.5 ? 1 : -1; }
    }
  }
  const wantAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 3));
  car.x = nx; car.y = ny;
  if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
    car.x = clamp(car.x, 60, WORLD - 60);
    car.y = clamp(car.y, 60, WORLD - 60);
    car.dir *= -1;
  }
  if (hitsBuilding(city, car.x, car.y, 20)) {
    car.x -= Math.cos(car.angle) * car.speed * dt;
    car.y -= Math.sin(car.angle) * car.speed * dt;
    car.speed *= 0.5;
  }
}

// Police chase the player: steer at them, ram, and give up slowly when
// the player breaks line of sight far away.
export function updatePoliceCar(city, car, dt, px, py, playerInCar, playerSpeed) {
  const target = angleTo(car.x, car.y, px, py);
  car.angle = angleLerp(car.angle, target, Math.min(1, dt * 2.2));
  const dist = distance(car.x, car.y, px, py);
  const want = dist > 90 ? car.def.topSpeed * (playerInCar ? 1.0 : 0.75) : car.def.topSpeed * 0.35;
  car.speed += clamp(want - car.speed, -320 * dt, car.def.accel * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD - 40);
  car.y = clamp(car.y, 40, WORLD - 40);
  const b = hitsBuilding(city, car.x, car.y, 20);
  if (b) {
    // Slide along the building instead of sticking to it.
    car.x -= Math.cos(car.angle) * car.speed * dt * 1.2;
    car.y -= Math.sin(car.angle) * car.speed * dt * 1.2;
    car.angle += dt * 2.5;
    car.speed *= 0.7;
  }
  return dist;
}

// The player's own car: arcade handling with drift and collisions.
export function updatePlayerCar(city, car, dt, input, cars, buildingsHit) {
  const def = car.def;
  if (input.up) car.speed += def.accel * dt;
  if (input.down) car.speed -= def.accel * 0.85 * dt;
  if (!input.up && !input.down) car.speed *= Math.max(0, 1 - dt * 0.9);
  car.speed = clamp(car.speed, -def.topSpeed * 0.45, def.topSpeed);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * 2.6 * steerFactor * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let crashed = false;
  if (hitsBuilding(city, nx, ny, 20)) { crashed = true; }
  else {
    for (const other of cars) {
      if (other === car) continue;
      if (distance(nx, ny, other.x, other.y) < 34 && Math.abs(car.speed) > 60) {
        // Shove the other car and slow down.
        other.x += Math.cos(car.angle) * 26;
        other.y += Math.sin(car.angle) * 26;
        other.speed = Math.max(other.speed, 60);
        crashed = true;
      } else if (distance(nx, ny, other.x, other.y) < 30) {
        crashed = true;
      }
    }
  }
  if (crashed) {
    car.speed *= 0.35;
    if (buildingsHit) buildingsHit();
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 40, WORLD - 40);
  car.y = clamp(car.y, 40, WORLD - 40);
  return crashed;
}

export function makeRngForVehicles(seed) { return makeRng(seed); }
