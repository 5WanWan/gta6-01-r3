// city.js — builds the city of Solmar Bay: roads, blocks, buildings,
// districts, beach, parks, and the fixed story locations.
import { makeRng } from './rng.js';

export const WORLD = 3600;          // city is WORLD x WORLD world units
export const BLOCK = 300;           // distance between road centre lines
export const ROAD_HALF = 34;        // half width of a road

export const DISTRICTS = [
  { name: 'MARINA', x: 150, y: 300, color: '#2fa8c9' },
  { name: 'DOWNTOWN', x: 1800, y: 1500, color: '#e8a13a' },
  { name: 'OLD TOWN', x: 600, y: 2400, color: '#c96a5a' },
  { name: 'PALM ROW', x: 3000, y: 600, color: '#7ec850' },
  { name: 'HARBOR', x: 3100, y: 3000, color: '#5a7ec9' },
  { name: 'BEACHFRONT', x: 1800, y: 3300, color: '#e8c95a' },
];

export const PALETTE = {
  grass: '#79c94f',
  grassDark: '#6ab844',
  sidewalk: '#d8d2c4',
  road: '#3c4148',
  roadEdge: '#2c3038',
  lane: '#f2d54b',
  beach: '#f0d896',
  water: '#2f9fd8',
  waterDeep: '#1f7fc0',
  plaza: '#c9c2ae',
};

// A building: a coloured roof, a height (for its shadow), a footprint.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const roofColors = ['#c95a4e', '#e8a13a', '#5a8fc9', '#7ec850', '#b06ac9', '#e86a8a', '#4ec9b0', '#d8d2c4', '#8a6ac9', '#c9b05a'];
  const roadsX = [];
  const roadsY = [];
  for (let x = BLOCK; x < WORLD; x += BLOCK) roadsX.push(x);
  for (let y = BLOCK; y < WORLD; y += BLOCK) roadsY.push(y);

  // Beach strip along the south edge, water beyond it.
  const beach = { x: 0, y: WORLD - 260, w: WORLD, h: 260 };

  for (let bx = 0; bx < roadsX.length - 1; bx++) {
    for (let by = 0; by < roadsY.length - 1; by++) {
      const x0 = roadsX[bx] + ROAD_HALF + 14;
      const y0 = roadsY[by] + ROAD_HALF + 14;
      const x1 = roadsX[bx + 1] - ROAD_HALF - 14;
      const y1 = roadsY[by + 1] - ROAD_HALF - 14;
      if (y0 > beach.y - 40) continue; // beach blocks stay open sand
      // A park every so often instead of buildings.
      if (rng.chance(0.14)) {
        const n = rng.int(4, 7);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.range(60, 110);
        const h = rng.range(60, 110);
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          color: rng.pick(roofColors),
          height: rng.int(1, 4),
          downtown: bx >= 4 && bx <= 7 && by >= 4 && by <= 7,
        });
      }
      if (rng.chance(0.5)) {
        trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), r: rng.range(9, 14) });
      }
    }
  }

  // Palm trees along the beach promenade.
  for (let x = 120; x < WORLD; x += 130) {
    trees.push({ x, y: beach.y - 30, r: 13, palm: true });
  }

  return {
    seed, buildings, trees, roadsX, roadsY, beach,
    // Fixed story locations, all on roads so cars can reach them.
    spots: {
      home: { x: 600, y: 600, label: 'VOSS GARAGE' },
      marina: { x: 300, y: 300, label: 'MARINA PIER' },
      market: { x: 1800, y: 1200, label: 'SOLMAR MARKET' },
      harbor: { x: 3000, y: 3000, label: 'HARBOR DOCKS' },
      hospital: { x: 1500, y: 2400, label: 'ST MIRA HOSPITAL' },
      savePoint: { x: 600, y: 900, label: 'SAVE — VOSS GARAGE' },
      beachBar: { x: 1800, y: 3300, label: 'SUNSET BAR' },
    },
  };
}

export function isOnRoad(city, x, y) {
  for (const rx of city.roadsX) if (Math.abs(x - rx) < ROAD_HALF) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < ROAD_HALF) return true;
  return false;
}

export function nearestRoadCoord(city, v) {
  let best = city.roadsX[0];
  let bestD = Infinity;
  for (const r of city.roadsX.concat(city.roadsY)) {
    const d = Math.abs(v - r);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// Snap a point onto the nearest road centre line.
export function snapToRoad(city, x, y) {
  const rx = nearestRoadCoord(city, x);
  const ry = nearestRoadCoord(city, y);
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y };
  return { x, y: ry };
}

// True when a circle overlaps any building footprint.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function districtAt(x, y) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}
