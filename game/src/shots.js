// shots.js — deterministic scene staging for screenshots.
// ?shot=chase | mission | drive | street stages a dense, real gameplay
// scene from a fixed seed with a simple autopilot, so a screenshot is a
// real render of the running game, reproducible from the same URL.
import { makeCar, spawnPoliceCar, spawnTrafficCar } from './vehicles.js';
import { makeEnemy } from './people.js';
import { raiseWanted } from './combat.js';
import { startMission } from './missions.js';
import { makeRng } from './rng.js';

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '20261118', 10),
    autostart: q.get('autostart') === '1',
  };
}

// Stage one of the four scenes. Mutates the live game state and returns
// the autopilot waypoint list the player car should follow.
export function stageShot(state, shotName) {
  const rng = makeRng(1337);
  const city = state.city;
  const player = state.player;
  state.shotMode = shotName;
  state.autopilot = true;
  state.phase = 'playing';
  state.mission.status = 'active';
  state.mission.dialogue = [];
  state.mission.dialogueIndex = 0;

  if (shotName === 'chase') {
    // Police chase: player in a red sports car, wanted 4, three cruisers
    // on his tail, dense traffic ahead, mission 2 mid-delivery.
    state.missionDef = startMission(state.mission, 1);
    state.mission.status = 'active';
    state.mission.step = 1;
    state.mission.hasPackage = true;
    state.mission.timer = 96;
    const car = makeCar(rng, 'sports', 1800, 1500, 0);
    car.speed = 320;
    state.cars.push(car);
    player.inCar = car;
    player.onFoot = false;
    player.x = car.x; player.y = car.y;
    player.cash = 2450;
    raiseWanted(player, 4);
    for (let i = 0; i < 3; i++) {
      const pc = spawnPoliceCar(city, rng, car.x, car.y);
      pc.x = car.x - 140 - i * 90;
      pc.y = car.y + (i - 1) * 70;
      state.cars.push(pc);
      state.police.push(pc);
    }
    for (let i = 0; i < 10; i++) {
      const t = spawnTrafficCar(city, rng, car.x, car.y);
      if (t) { t.x = car.x + 200 + i * 160; t.y = 1500 + (i % 2 ? -20 : 20); t.axis = 'x'; t.dir = 1; state.cars.push(t); }
    }
    state.waypoints = [
      { x: 2100, y: 1500 }, { x: 2400, y: 1500 }, { x: 2700, y: 1500 },
      { x: 3000, y: 1500 }, { x: 3000, y: 1800 }, { x: 3000, y: 2100 },
    ];
    state.feed.push('📻 DISPATCH: all units, red Vortex GT fleeing Downtown');
    state.feed.push('💥 MARA: "They are on you — lose them and bring the package!"');
    state.radio = '📻 SOLMAR PD: "Unit 7 in pursuit, Downtown, requesting backup"';
    return;
  }

  if (shotName === 'mission') {
    // Mission 3 shootout at the Harbor Docks: on foot, pistol out,
    // three Kestrel crew members, wanted 3, package case on the ground.
    state.missionDef = startMission(state.mission, 2);
    state.mission.status = 'active';
    state.mission.step = 0;
    state.mission.enemiesSpawned = true;
    state.mission.timer = 187;
    player.x = 2880; player.y = 2880;
    player.angle = Math.PI / 4;
    player.weapon = 'pistol';
    player.ammo = 24;
    player.cash = 3120;
    raiseWanted(player, 3);
    const spots = [[3030, 2970], [3120, 2880], [2970, 3060], [3150, 3030]];
    for (const [ex, ey] of spots) {
      const e = makeEnemy(rng, ex, ey);
      e.state = 'chase';
      state.enemies.push(e);
    }
    for (let i = 0; i < 4; i++) {
      const t = spawnTrafficCar(city, rng, player.x, player.y);
      if (t) state.cars.push(t);
    }
    state.cashPickups.push({ x: 3060, y: 3000, amount: 250 });
    state.feed.push('💥 MARA: "The Kestrel crew has the case. Take it — any way you have to."');
    state.feed.push('🔫 KESTREL: "Voss! You picked the wrong docks, friend."');
    state.radio = '📻 SOLMAR PD: "Shots reported at the Harbor Docks"';
    return;
  }

  if (shotName === 'drive') {
    // Sunset cruise: player driving a muscle car down Palm Row boulevard,
    // traffic and pedestrians everywhere, wanted 1, mission 1 mid-delivery.
    state.missionDef = startMission(state.mission, 0);
    state.mission.status = 'active';
    state.mission.step = 1;
    const car = makeCar(rng, 'muscle', 2400, 600, 0);
    car.speed = 260;
    state.cars.push(car);
    player.inCar = car;
    player.onFoot = false;
    player.x = car.x; player.y = car.y;
    player.cash = 680;
    raiseWanted(player, 1);
    for (let i = 0; i < 12; i++) {
      const t = spawnTrafficCar(city, rng, car.x, car.y);
      if (t) { t.x = car.x + 150 + i * 170; t.y = 600 + (i % 2 ? -18 : 18); t.axis = 'x'; t.dir = 1; state.cars.push(t); }
    }
    state.waypoints = [
      { x: 2700, y: 600 }, { x: 3000, y: 600 }, { x: 3300, y: 600 }, { x: 3300, y: 900 },
    ];
    state.feed.push('🚗 MARA: "Nice wheels. Now bring it to my garage — no scratches."');
    state.radio = '📻 SUN 98 FM: "Cruising Palm Row with the evening breeze…"';
    return;
  }

  // Default: 'street' — on foot in Downtown, pistol ready, traffic and
  // pedestrians around, mission 2 briefing objective on the HUD.
  state.missionDef = startMission(state.mission, 1);
  state.mission.status = 'active';
  state.mission.step = 0;
  state.mission.timer = 142;
  player.x = 1800; player.y = 1500;
  player.angle = -Math.PI / 2;
  player.weapon = 'pistol';
  player.ammo = 18;
  player.cash = 1540;
  raiseWanted(player, 2);
  for (let i = 0; i < 8; i++) {
    const t = spawnTrafficCar(city, rng, player.x, player.y);
    if (t) state.cars.push(t);
  }
  const pc = spawnPoliceCar(city, rng, player.x, player.y);
  pc.x = player.x - 300; pc.y = player.y + 120;
  state.cars.push(pc);
  state.police.push(pc);
  state.cashPickups.push({ x: 1900, y: 1560, amount: 150 });
  state.feed.push('🚶 MARA: "Package is waiting at Solmar Market. Go get it."');
  state.feed.push('👀 A Sun Cab just ran a red light in Downtown');
  state.radio = '📻 SOLMAR PD: "Unit 3 responding, Downtown"';
}

// Autopilot: drives the player's car along the staged waypoints and
// walks the player toward the mission target when on foot.
export function autopilotDrive(state, dt) {
  const player = state.player;
  const input = state.input;
  input.up = false; input.down = false; input.left = false; input.right = false;
  if (player.inCar) {
    const wp = state.waypoints && state.waypoints[0];
    if (!wp) return;
    const car = player.inCar;
    const dx = wp.x - car.x;
    const dy = wp.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120) { state.waypoints.shift(); return; }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.up = true;
    if (diff > 0.12) input.right = true;
    else if (diff < -0.12) input.left = true;
    if (Math.abs(diff) > 0.9) input.up = false;
  } else {
    const target = state.target;
    if (!target) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    if (Math.hypot(dx, dy) < 100) return;
    input.up = dy < -20;
    input.down = dy > 20;
    input.left = dx < -20;
    input.right = dx > 20;
  }
}
