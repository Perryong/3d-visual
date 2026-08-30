/**
 * Per-sheet scene colours and camera. The tank sheet is the dark blueprint;
 * other sheets supply their own object with the same keys.
 */
export const TANK_THEME = {
  clear: 0x070f18,
  fog: { near: 28, far: 62 },
  grid: { size: 60, div: 60, c1: 0x1d4258, c2: 0x122d3d },
  edge: { color: 0x5cc8f2, opacity: 0.55 },
  camera: [12.5, 7.5, 14],
  target: [0, 1.6, 0],
  minDistance: 6,
  maxDistance: 55,
  maxPolarAngle: Math.PI * 0.52,
  select: { color: 0xf2a33c, emissive: 0x6b3d05 },
};

export const URBAN_THEME = {
  clear: 0xffffff,
  fog: null,
  grid: null,
  edge: null,
  camera: [0, 44, 52],
  target: [0, 18, 0],
  minDistance: 30,
  maxDistance: 180,
  maxPolarAngle: Math.PI * 0.48,
  select: { color: 0xd9480f, emissive: 0x000000 },
  poster: { azimuth: 30, elevation: 35, explodeStep: 5.2, fit: 1.12 },
};
