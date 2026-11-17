// save.js — save and load through localStorage. Saves happen at the
// garage save point, after each mission, and with the quick-save key.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      cash: state.player.cash,
      hp: state.player.hp,
      x: state.player.x,
      y: state.player.y,
      wanted: state.player.wanted,
      kills: state.player.kills,
      carsStolen: state.player.carsStolen,
      missionsDone: state.player.missionsDone,
      missionIndex: state.mission.index,
      missionStatus: state.mission.status,
      weapon: state.player.weapon,
      ammo: state.player.ammo,
      playTime: state.playTime,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
