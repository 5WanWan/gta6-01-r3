// missions.js — the story of Solmar Bay: three missions with dialogue,
// objectives, rewards, and fail states. Dario Voss, a wheelman fresh out
// of the Marina lock-up, works off a debt to fixer Mara Kline.
import { distance } from './rng.js';

export const STORY_INTRO = [
  'SOLMAR BAY — a sun-soaked city where the tide brings in money and trouble in equal measure.',
  'DARIO VOSS just walked out of the Marina lock-up. He owes fixer MARA KLINE $5,000.',
  'Mara has work. Three jobs. Finish them, and the debt is gone — and the city is his.',
];

export const MISSIONS = [
  {
    id: 1,
    title: 'MISSION 1 — FIRST WHEELS',
    giver: 'MARA KLINE',
    briefing: [
      'MARA: "Voss. You need wheels before you need anything else."',
      'MARA: "There is a Vortex GT parked on Palm Row. Take it. Don\'t ask whose it is."',
      'MARA: "Bring it to my garage on Harbor Street. And try not to scratch it."',
    ],
    objectiveText: 'Steal a car and drive it to the VOSS GARAGE',
    objectiveShort: 'Steal a car, drive to the garage',
    reward: 400,
    timeLimit: 0,
    steps: ['steal', 'deliver'],
  },
  {
    id: 2,
    title: 'MISSION 2 — THE DROP',
    giver: 'MARA KLINE',
    briefing: [
      'MARA: "Good. You still know how to drive."',
      'MARA: "Now the real work. Pick up the package at Solmar Market."',
      'MARA: "Deliver it to the Harbor Docks. The PD is sniffing around — stay fast, stay quiet."',
    ],
    objectiveText: 'Pick up the package at the Market, deliver it to the Harbor Docks',
    objectiveShort: 'Pick up the package, deliver to the Docks',
    reward: 900,
    timeLimit: 150,
    steps: ['pickup', 'deliver'],
  },
  {
    id: 3,
    title: 'MISSION 3 — HARBOR HEAT',
    giver: 'MARA KLINE',
    briefing: [
      'MARA: "Last job, Voss. The Kestrel crew is waiting at the Docks with what they owe me."',
      'MARA: "They will not hand it over. Take the case from them — any way you have to."',
      'MARA: "Then bring it to the Sunset Bar on the beach. After this, you are free."',
    ],
    objectiveText: 'Take the case from the Kestrel crew, then reach the Sunset Bar',
    objectiveShort: 'Take the case, reach the Sunset Bar',
    reward: 1500,
    timeLimit: 240,
    steps: ['fight', 'deliver'],
  },
];

export function createMissionState() {
  return {
    index: 0,                 // which mission is active (0-based)
    step: 0,                  // which step inside the mission
    status: 'briefing',       // briefing | active | done | failed | story-done
    timer: 0,
    dialogue: [...STORY_INTRO],
    dialogueIndex: 0,
    banner: null,             // { text, sub, t }
    hasPackage: false,
    hasCase: false,
    enemiesSpawned: false,
    enemiesLeft: 0,
  };
}

export function startMission(ms, index) {
  const m = MISSIONS[index];
  ms.index = index;
  ms.step = 0;
  ms.status = 'briefing';
  ms.timer = m.timeLimit;
  ms.dialogue = [...m.briefing];
  ms.dialogueIndex = 0;
  ms.hasPackage = false;
  ms.hasCase = false;
  ms.enemiesSpawned = false;
  ms.enemiesLeft = 0;
  return m;
}

export function currentMission(ms) {
  return MISSIONS[ms.index] || null;
}

export function missionTarget(ms, city) {
  const m = currentMission(ms);
  if (!m) return null;
  if (m.id === 1) {
    return ms.step === 0 ? { x: 3000, y: 600, label: 'STEAL A CAR — PALM ROW' } : city.spots.home;
  }
  if (m.id === 2) {
    return ms.step === 0 ? city.spots.market : city.spots.harbor;
  }
  if (m.id === 3) {
    return ms.step === 0 ? city.spots.harbor : city.spots.beachBar;
  }
  return null;
}

// Advance a mission when the player reaches its target. Returns an event
// string ('picked-up', 'delivered', 'case-taken', 'mission-complete') or null.
export function checkMissionProgress(ms, city, player, enemies) {
  const m = currentMission(ms);
  if (!m || ms.status !== 'active') return null;
  const target = missionTarget(ms, city);
  if (!target) return null;
  const atTarget = distance(player.x, player.y, target.x, target.y) < 90;
  if (m.id === 1) {
    if (ms.step === 0 && player.inCar) {
      ms.step = 1;
      return 'car-stolen';
    }
    if (ms.step === 1 && atTarget && player.inCar) {
      return completeMission(ms, player);
    }
  }
  if (m.id === 2) {
    if (ms.step === 0 && atTarget) {
      ms.step = 1;
      ms.hasPackage = true;
      return 'picked-up';
    }
    if (ms.step === 1 && atTarget) {
      ms.hasPackage = false;
      return completeMission(ms, player);
    }
  }
  if (m.id === 3) {
    if (ms.step === 0) {
      const alive = enemies.filter((e) => e.alive).length;
      ms.enemiesLeft = alive;
      if (ms.enemiesSpawned && alive === 0) {
        ms.step = 1;
        ms.hasCase = true;
        return 'case-taken';
      }
    }
    if (ms.step === 1 && atTarget) {
      ms.hasCase = false;
      return completeMission(ms, player);
    }
  }
  return null;
}

export function completeMission(ms, player) {
  const m = currentMission(ms);
  player.cash += m.reward;
  player.missionsDone += 1;
  ms.status = 'done';
  ms.banner = { text: 'MISSION PASSED', sub: `+$${m.reward}  —  ${m.title}`, t: 4 };
  return 'mission-complete';
}

export function failMission(ms, reason) {
  ms.status = 'failed';
  ms.banner = { text: 'MISSION FAILED', sub: reason, t: 4 };
  return 'mission-failed';
}

// After a mission is done, the next one starts with its briefing.
export function advanceToNextMission(ms) {
  if (ms.index + 1 >= MISSIONS.length) {
    ms.status = 'story-done';
    ms.banner = { text: 'DEBT PAID — SOLMAR BAY IS YOURS', sub: 'All three jobs done. Free roam: keep the city, keep the cash.', t: 6 };
    return null;
  }
  return startMission(ms, ms.index + 1);
}

export function missionTimerTick(ms, dt) {
  const m = currentMission(ms);
  if (!m || ms.status !== 'active' || m.timeLimit === 0) return null;
  ms.timer -= dt;
  if (ms.timer <= 0) {
    failMission(ms, 'Out of time — the drop went cold.');
    return 'mission-failed';
  }
  return null;
}
