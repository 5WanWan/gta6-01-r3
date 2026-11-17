// main.js — SOLMAR BAY: game loop, input, state machine and wiring.
// Boots the city, runs the world, and draws every frame.
import { buildCity, districtAt, WORLD } from './city.js';
import { makeRng, clamp, distance, angleTo } from './rng.js';
import { createAudio } from './audio.js';
import {
  makeCar, spawnTrafficCar, spawnParkedCar, spawnPoliceCar,
  updateTrafficCar, updatePoliceCar, updatePlayerCar, CAR_TYPES,
} from './vehicles.js';
import { makePlayer, makeEnemy, makePedestrian, spawnPedestrians, updatePlayerOnFoot, updatePedestrian, updateEnemy } from './people.js';
import {
  createMissionState, startMission, currentMission, missionTarget,
  checkMissionProgress, advanceToNextMission, missionTimerTick, STORY_INTRO,
} from './missions.js';
import {
  makeBullets, fireBullet, updateBullets, punch, raiseWanted,
  wantedDecay, policeWantedCount, policeRamDamage,
} from './combat.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { createRenderer, drawCity, drawCar, drawPerson, drawBullet, drawParticles, drawMarker, drawSavePoint, drawCashPickup } from './render.js';
import { drawHud, drawDialogue, drawStartScreen, drawPaused, drawWasted } from './hud.js';
import { readShotParams, stageShot, autopilotDrive } from './shots.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const ctx = renderer.ctx;
const W = renderer.W;
const H = renderer.H;

const params = readShotParams();
const SEED = params.seed;
const rng = makeRng(SEED);

const audio = createAudio();

const state = {
  city: buildCity(SEED),
  player: makePlayer(600, 700),
  cars: [],
  peds: [],
  enemies: [],
  bullets: makeBullets(),
  particles: [],
  police: [],
  cashPickups: [],
  mission: createMissionState(),
  missionDef: null,
  feed: [],
  radio: '📻 SUN 98 FM: "Good morning, Solmar Bay — sunny and 28 degrees."',
  phase: 'start',
  playTime: 0,
  cam: { x: 0, y: 0 },
  input: { up: false, down: false, left: false, right: false, run: false },
  mouse: { x: W / 2, y: H / 2, down: false },
  target: null,
  districtName: 'MARINA',
  waypoints: null,
  shotMode: null,
  autopilot: false,
  hasSave: hasSave(),
  shootCooldown: 0,
  wantedCooldown: 0,
  radioTimer: 12,
  spawnTimer: 2,
  wastedTimer: 0,
  shotFireTimer: 0,
};

function addFeed(text) {
  state.feed.push(text);
  if (state.feed.length > 8) state.feed.shift();
}

function addParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const s = rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rng.range(0.3, 0.7), maxLife: 0.7, size: rng.range(2, 5), color,
    });
  }
}

// --- World setup ---------------------------------------------------------
function setupWorld() {
  const { city, player } = state;
  player.x = city.spots.home.x;
  player.y = city.spots.home.y + 90;
  // Parked cars the player can steal, including one right by the garage.
  const starter = makeCar(rng, 'sedan', 660, 640, Math.PI / 2);
  starter.parked = true;
  starter.driver = 'none';
  state.cars.push(starter);
  for (let i = 0; i < 7; i++) {
    const c = spawnParkedCar(city, rng, player.x, player.y);
    if (c) state.cars.push(c);
  }
  for (let i = 0; i < 14; i++) {
    const c = spawnTrafficCar(city, rng, player.x, player.y);
    if (c) state.cars.push(c);
  }
  state.peds = spawnPedestrians(city, rng, 26, player.x, player.y);
  state.cashPickups.push({ x: 1500, y: 1500, amount: 100 });
  state.cashPickups.push({ x: 2400, y: 2400, amount: 150 });
  state.cashPickups.push({ x: 900, y: 3000, amount: 120 });
  state.missionDef = startMission(state.mission, 0);
}

setupWorld();

// --- Input ---------------------------------------------------------------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

window.addEventListener('keydown', (e) => {
  audio.ensure();
  const dir = KEYMAP[e.code];
  if (dir) { state.input[dir] = true; e.preventDefault(); }
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); addFeed(audio.muted ? '🔇 Sound muted' : '🔊 Sound on'); }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.phase === 'playing') { state.phase = 'paused'; }
    else if (state.phase === 'paused') { state.phase = 'playing'; }
  }
  if (e.code === 'Enter') handleEnter();
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'Space') {
    if (state.phase === 'playing' && !state.player.inCar) {
      const hit = punch(state.player, state.enemies, state.peds, onCombatEvent);
      if (hit) { audio.punch(); raiseWanted(state.player, 1); addFeed('👊 You threw a punch — somebody called the cops'); }
    }
    e.preventDefault();
  }
  if (e.code === 'KeyF') trySaveAtGarage();
});

window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) state.input[dir] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (W / r.width);
  state.mouse.y = (e.clientY - r.top) * (H / r.height);
});

canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  state.mouse.down = true;
  if (state.phase === 'start') { handleEnter(); return; }
  tryShoot();
});

canvas.addEventListener('mouseup', () => { state.mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function handleEnter() {
  if (state.phase === 'start') {
    state.phase = 'dialogue';
    state.mission.dialogue = [...STORY_INTRO, ...state.missionDef.briefing];
    state.mission.dialogueIndex = 0;
    audio.ensure();
    return;
  }
  if (state.phase === 'dialogue') {
    state.mission.dialogueIndex += 1;
    if (state.mission.dialogueIndex >= state.mission.dialogue.length) {
      state.phase = 'playing';
      state.mission.status = 'active';
      state.mission.timer = state.missionDef.timeLimit;
      addFeed(`🎯 ${state.missionDef.title}`);
      addFeed(`📍 Objective: ${state.missionDef.objectiveShort}`);
    }
    return;
  }
  if (state.phase === 'wasted') {
    respawnPlayer();
    return;
  }
  if (state.phase === 'playing' && state.mission.status === 'briefing') {
    state.phase = 'dialogue';
    state.mission.dialogueIndex = 0;
  }
}

function respawnPlayer() {
  const p = state.player;
  p.hp = p.maxHp;
  p.wanted = 0;
  p.cash = Math.max(0, p.cash - 200);
  p.x = state.city.spots.hospital.x;
  p.y = state.city.spots.hospital.y;
  p.inCar = null;
  p.onFoot = true;
  state.police = [];
  state.cars = state.cars.filter((c) => c.type !== 'police');
  state.phase = 'playing';
  addFeed('🏥 St Mira Hospital patched you up. -$200.');
}

function trySaveAtGarage() {
  if (state.phase !== 'playing') return;
  const sp = state.city.spots.savePoint;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (distance(px, py, sp.x, sp.y) < 130) {
    if (saveGame(state)) { addFeed('💾 Game saved at the Voss Garage.'); audio.pickup(); }
  }
}

// --- Car enter / steal ---------------------------------------------------
function nearestCar(maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.type === 'police') continue;
    const d = distance(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function tryEnterExitCar() {
  if (state.phase !== 'playing') return;
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    p.angle = car.angle;
    addFeed(`🚶 You got out of the ${car.def.name}.`);
    return;
  }
  const car = nearestCar(70);
  if (!car) return;
  const stolen = car.parked || car.driver === 'traffic';
  if (stolen && !car.stolen) {
    car.stolen = true;
    car.parked = false;
    car.driver = 'player';
    p.carsStolen += 1;
    raiseWanted(p, 1);
    addFeed(`🚗 You stole a ${car.def.name}! The owner is calling the cops…`);
    audio.sirenBlip();
    addParticles(car.x, car.y, '#ffe14d', 10, 120);
  } else {
    car.driver = 'player';
    addFeed(`🚗 You hopped into the ${car.def.name}.`);
  }
  p.inCar = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
}

// --- Combat --------------------------------------------------------------
function tryShoot() {
  const p = state.player;
  if (state.phase !== 'playing' || p.inCar || p.weapon !== 'pistol') return;
  if (state.shootCooldown > 0 || p.ammo <= 0) {
    if (p.ammo <= 0) addFeed('🔫 Out of bullets — find ammo or use your fists (Space).');
    return;
  }
  state.shootCooldown = 0.28;
  p.ammo -= 1;
  const wx = state.mouse.x + state.cam.x;
  const wy = state.mouse.y + state.cam.y;
  const angle = angleTo(p.x, p.y, wx, wy);
  p.angle = angle;
  fireBullet(state.bullets, p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, angle, true);
  addParticles(p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22, '#ffe14d', 6, 160);
  audio.gunshot();
  for (const ped of state.peds) {
    if (distance(ped.x, ped.y, p.x, p.y) < 320) ped.panic = 3;
  }
  if (state.wantedCooldown <= 0) {
    raiseWanted(p, 1);
    state.wantedCooldown = 8;
    addFeed('🔫 Shots fired — Solmar PD is on the way.');
  }
}

function onCombatEvent(kind, target) {
  const p = state.player;
  if (kind === 'enemy-killed') {
    p.kills += 1;
    p.cash += 50;
    addFeed('💀 Kestrel crew member down. +$50');
    addParticles(target.x, target.y, '#c0392b', 14, 140);
    audio.cash();
  } else if (kind === 'player-hit') {
    addParticles(p.x, p.y, '#c0392b', 6, 100);
  } else if (kind === 'ped-punched') {
    addFeed('😠 A pedestrian is screaming for the police!');
  }
}

// --- Police management ---------------------------------------------------
function managePolice(dt) {
  const p = state.player;
  const want = policeWantedCount(p.wanted);
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  while (state.police.length < want) {
    const pc = spawnPoliceCar(state.city, rng, px, py);
    state.police.push(pc);
    state.cars.push(pc);
    addFeed('🚨 A Solmar PD cruiser joins the chase!');
  }
  // Despawn far-away cruisers once the heat is off.
  if (p.wanted === 0) {
    for (let i = state.police.length - 1; i >= 0; i--) {
      const pc = state.police[i];
      if (distance(pc.x, pc.y, px, py) > 1400) {
        state.police.splice(i, 1);
        state.cars.splice(state.cars.indexOf(pc), 1);
      }
    }
  }
}

// --- Mission helpers -----------------------------------------------------
function spawnMissionEnemies() {
  const spots = [
    [3060, 2940], [3120, 3030], [2970, 3060], [3150, 2910],
  ];
  for (const [x, y] of spots) {
    const e = makeEnemy(rng, x, y);
    state.enemies.push(e);
  }
  state.mission.enemiesSpawned = true;
  state.mission.enemiesLeft = state.enemies.filter((e) => e.alive).length;
  addFeed('🔫 Four Kestrel crew members guard the case!');
}

function handleMissionEvent(event) {
  const p = state.player;
  if (event === 'car-stolen') {
    addFeed('🚗 Car stolen — now drive it to the Voss Garage.');
    audio.pickup();
  } else if (event === 'picked-up') {
    addFeed('📦 Package picked up. Deliver it to the Harbor Docks — fast!');
    raiseWanted(p, 1);
    audio.pickup();
  } else if (event === 'case-taken') {
    addFeed('💼 Case taken! Get to the Sunset Bar on the beach!');
    audio.cash();
  } else if (event === 'mission-complete') {
    audio.missionDone();
    if (saveGame(state)) addFeed('💾 Progress saved.');
    state.missionDef = advanceToNextMission(state.mission);
    if (state.missionDef) {
      state.phase = 'dialogue';
      state.mission.dialogue = [...state.missionDef.briefing];
      state.mission.dialogueIndex = 0;
    }
  } else if (event === 'mission-failed') {
    audio.fail();
    // Retry the same mission after a short beat.
    setTimeout(() => {
      state.missionDef = startMission(state.mission, state.mission.index);
      state.phase = 'dialogue';
      state.mission.dialogue = [...state.missionDef.briefing];
      state.mission.dialogueIndex = 0;
    }, 1500);
  }
}

// --- Update --------------------------------------------------------------
const RADIO_LINES = [
  '📻 SOLMAR PD: "All units, be advised — a red sedan was seen speeding on Palm Row."',
  '📻 SUN 98 FM: "That was the Solmar Sound — next up, the evening traffic report."',
  '📻 SOLMAR PD: "Unit 12, respond to a disturbance near the Marina."',
  '📻 SUN 98 FM: "Beach weather all week, folks. Stay sunny, Solmar."',
  '📻 SOLMAR PD: "Reminder: lock your cars. Joyriders are out tonight."',
];

function update(dt) {
  const p = state.player;
  const ms = state.mission;
  state.playTime += dt;
  if (state.shootCooldown > 0) state.shootCooldown -= dt;
  if (state.wantedCooldown > 0) state.wantedCooldown -= dt;
  if (ms.banner && ms.banner.t > 0) ms.banner.t -= dt;

  // Radio chatter rotates on a timer.
  state.radioTimer -= dt;
  if (state.radioTimer <= 0) {
    state.radioTimer = 14 + rng.range(0, 8);
    state.radio = RADIO_LINES[Math.floor(rng.range(0, RADIO_LINES.length))];
  }

  if (state.autopilot) autopilotDrive(state, dt);

  // Aim on foot with the mouse when holding the pistol.
  if (!p.inCar && p.weapon === 'pistol' && state.phase === 'playing') {
    const wx = state.mouse.x + state.cam.x;
    const wy = state.mouse.y + state.cam.y;
    if (distance(wx, wy, p.x, p.y) > 30) p.angle = angleTo(p.x, p.y, wx, wy);
  }

  // Shot mode: the mission scene fires back on its own for a lively shot.
  if (state.shotMode === 'mission') {
    state.shotFireTimer -= dt;
    if (state.shotFireTimer <= 0) {
      state.shotFireTimer = 1.1;
      const target = state.enemies.find((e) => e.alive);
      if (target && p.ammo > 0) {
        state.mouse.x = target.x - state.cam.x;
        state.mouse.y = target.y - state.cam.y;
        tryShoot();
      }
    }
  }

  // Movement.
  if (p.inCar) {
    const crashed = updatePlayerCar(state.city, p.inCar, dt, state.input, state.cars, () => {
      addParticles(p.inCar.x, p.inCar.y, '#ffb03a', 8, 120);
    });
    p.x = p.inCar.x; p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    audio.setEngine(Math.abs(p.inCar.speed) / p.inCar.def.topSpeed, true);
  } else {
    updatePlayerOnFoot(p, dt, state.input, state.city);
    audio.setEngine(0, false);
  }

  // Traffic, police, pedestrians, enemies.
  for (const car of state.cars) {
    if (car === p.inCar) continue;
    if (car.type === 'police') {
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      const dist = updatePoliceCar(state.city, car, dt, px, py, !!p.inCar, p.inCar ? p.inCar.speed : 0);
      if (dist < 46) {
        policeRamDamage(p);
        addParticles(px, py, '#ff6a5a', 8, 120);
        car.speed *= 0.4;
      }
    } else {
      updateTrafficCar(state.city, car, dt, state.cars);
    }
  }
  managePolice(dt);
  wantedDecay(p, dt, state.police.length > 0);

  const danger = state.bullets.some((b) => b.fromPlayer);
  for (const ped of state.peds) {
    updatePedestrian(ped, dt, state.city, danger ? p.x : null, danger ? p.y : null, 320);
  }
  for (const e of state.enemies) {
    updateEnemy(e, dt, p, state.city, (enemy) => {
      const a = angleTo(enemy.x, enemy.y, p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y);
      fireBullet(state.bullets, enemy.x, enemy.y, a, false);
      audio.gunshot();
      addParticles(enemy.x + Math.cos(a) * 20, enemy.y + Math.sin(a) * 20, '#ffe14d', 4, 120);
    });
  }
  updateBullets(state.bullets, dt, state.city, p, state.enemies, state.peds, state.cars, onCombatEvent);

  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  // Cash pickups.
  for (let i = state.cashPickups.length - 1; i >= 0; i--) {
    const cp = state.cashPickups[i];
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (distance(px, py, cp.x, cp.y) < 40) {
      p.cash += cp.amount;
      addFeed(`💵 Found $${cp.amount} on the street.`);
      audio.cash();
      state.cashPickups.splice(i, 1);
    }
  }

  // Keep the world populated near the player.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 2;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const trafficNear = state.cars.filter((c) => c.type !== 'police' && distance(c.x, c.y, px, py) < 700).length;
    if (trafficNear < 8) {
      const c = spawnTrafficCar(state.city, rng, px, py);
      if (c) state.cars.push(c);
    }
    if (state.peds.length < 20) {
      const np = spawnPedestrians(state.city, rng, 4, px, py);
      state.peds.push(...np);
    }
    // Remove far-away traffic to keep the simulation cheap.
    state.cars = state.cars.filter((c) => c.type === 'police' || c.parked || distance(c.x, c.y, px, py) < 1500 || c === p.inCar);
    state.peds = state.peds.filter((ped) => distance(ped.x, ped.y, px, py) < 1200);
  }

  // Mission 3: spawn the Kestrel crew when the player reaches the Docks.
  if (state.missionDef && state.missionDef.id === 3 && ms.status === 'active' && ms.step === 0 && !ms.enemiesSpawned) {
    if (distance(p.x, p.y, state.city.spots.harbor.x, state.city.spots.harbor.y) < 500) {
      spawnMissionEnemies();
    }
  }

  // Mission progress + timer.
  if (ms.status === 'active') {
    const event = checkMissionProgress(ms, state.city, p, state.enemies);
    if (event) handleMissionEvent(event);
    const fail = missionTimerTick(ms, dt);
    if (fail) handleMissionEvent(fail);
    // Reward the pistol after the first mission's steal.
    if (state.missionDef && state.missionDef.id === 1 && ms.step === 1 && p.weapon === 'fists') {
      p.weapon = 'pistol';
      p.ammo = 12;
      addFeed('🔫 Mara slipped you a pistol. 12 bullets. Make them count.');
    }
  }

  // Wasted?
  if (p.hp <= 0 && state.phase === 'playing') {
    state.phase = 'wasted';
    state.wastedTimer = 0;
    audio.fail();
    addFeed('💀 WASTED — the Solmar PD got you.');
  }

  // Camera follows the player.
  const tx = p.x - W / 2;
  const ty = p.y - H / 2;
  state.cam.x = clamp(tx, 0, WORLD - W);
  state.cam.y = clamp(ty, 0, WORLD - H);
  state.target = ms.status === 'active' ? missionTarget(ms, state.city) : null;
  state.districtName = districtAt(p.x, p.y).name;
  audio.musicStep(dt, p.wanted);
}

// --- Render --------------------------------------------------------------
function render(now) {
  const p = state.player;
  const ms = state.mission;
  ctx.clearRect(0, 0, W, H);
  const cam = {
    x0: state.cam.x, y0: state.cam.y,
    x1: state.cam.x + W, y1: state.cam.y + H,
  };
  ctx.save();
  ctx.translate(-state.cam.x, -state.cam.y);
  drawCity(ctx, state.city, cam);
  drawSavePoint(ctx, state.city.spots.savePoint.x, state.city.spots.savePoint.y, now);
  for (const cp of state.cashPickups) drawCashPickup(ctx, cp.x, cp.y, now);
  if (state.target) drawMarker(ctx, state.target.x, state.target.y, state.target.label, now, '#ffe14d');
  for (const car of state.cars) drawCar(ctx, car, now);
  for (const ped of state.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, { walking: true, walkPhase: now / 160 + ped.x });
  }
  for (const e of state.enemies) {
    if (!e.alive) continue;
    drawPerson(ctx, e.x, e.y, e.angle, e.shirt, e.skin, { weapon: 'pistol', pants: '#20242c' });
    // Enemy health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(e.x - 16, e.y - 26, 32 * clamp(e.hp / 60, 0, 1), 5);
  }
  if (!p.inCar) {
    drawPerson(ctx, p.x, p.y, p.angle, '#e83a3a', '#e8b98a', {
      weapon: p.weapon, punching: p.punchTimer > 0, walking: p.speed > 0, walkPhase: now / 140,
    });
  }
  for (const b of state.bullets) drawBullet(ctx, b);
  drawParticles(ctx, state.particles);
  ctx.restore();

  // Aim crosshair when the pistol is out.
  if (state.phase === 'playing' && !p.inCar && p.weapon === 'pistol') {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(state.mouse.x, state.mouse.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(state.mouse.x - 14, state.mouse.y); ctx.lineTo(state.mouse.x - 5, state.mouse.y);
    ctx.moveTo(state.mouse.x + 5, state.mouse.y); ctx.lineTo(state.mouse.x + 14, state.mouse.y);
    ctx.moveTo(state.mouse.x, state.mouse.y - 14); ctx.lineTo(state.mouse.x, state.mouse.y - 5);
    ctx.moveTo(state.mouse.x, state.mouse.y + 5); ctx.lineTo(state.mouse.x, state.mouse.y + 14);
    ctx.stroke();
  }

  drawHud(ctx, W, H, state, now);
  if (state.phase === 'start') drawStartScreen(ctx, W, H, state, now);
  else if (state.phase === 'dialogue') drawDialogue(ctx, W, H, ms.dialogue, ms.dialogueIndex);
  else if (state.phase === 'paused') drawPaused(ctx, W, H);
  else if (state.phase === 'wasted') drawWasted(ctx, W, H, state);
}

// --- Boot ----------------------------------------------------------------
if (params.shot) {
  stageShot(state, params.shot);
  state.hasSave = false;
  // In shot mode the game starts already playing, staged and dense.
  state.phase = 'playing';
} else if (params.autostart) {
  state.phase = 'dialogue';
  state.mission.dialogue = [...STORY_INTRO, ...state.missionDef.briefing];
  state.mission.dialogueIndex = 0;
}

// Load a save if the player asked for it from the start screen.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL' && state.phase === 'start' && state.hasSave) {
    const save = loadSave();
    if (save) {
      const p = state.player;
      p.cash = save.cash; p.hp = save.hp;
      p.x = save.x; p.y = save.y;
      p.wanted = save.wanted; p.kills = save.kills;
      p.carsStolen = save.carsStolen; p.missionsDone = save.missionsDone;
      p.weapon = save.weapon; p.ammo = save.ammo;
      state.playTime = save.playTime || 0;
      state.missionDef = startMission(state.mission, Math.min(save.missionIndex, 2));
      state.phase = 'playing';
      state.mission.status = 'active';
      addFeed('💾 Save loaded — welcome back to Solmar Bay.');
    }
  }
});

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (state.phase === 'playing') update(dt);
  else if (state.phase === 'dialogue' || state.phase === 'start') {
    // The city still breathes behind menus: traffic cruises on.
    for (const car of state.cars) {
      if (car.type !== 'police') updateTrafficCar(state.city, car, dt, state.cars);
    }
  }
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
