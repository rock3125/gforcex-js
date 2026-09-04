/**
 * The cave's mutable grid lives here so generation and destruction run in
 * WebAssembly. Rendering, input, sound, and UI deliberately stay in JavaScript.
 */
export const GRID_RES: i32 = 30;
const CELL_COUNT: i32 = GRID_RES * GRID_RES;
const WATER_ROW: i32 = 18;

const grid = new StaticArray<i32>(CELL_COUNT);
const damage = new StaticArray<i32>(CELL_COUNT);
const materials = new StaticArray<i32>(CELL_COUNT);
const nextGrid = new StaticArray<i32>(CELL_COUNT);
const visited = new StaticArray<i32>(CELL_COUNT);
const queue = new StaticArray<i32>(CELL_COUNT);
const region = new StaticArray<i32>(CELL_COUNT);
const largestRegion = new StaticArray<i32>(CELL_COUNT);

let randomState: u32 = 1;

@inline
function index(x: i32, y: i32): i32 {
  return x * GRID_RES + y;
}

@inline
function random(): f64 {
  randomState = randomState * 1664525 + 1013904223;
  return <f64>(randomState >>> 8) / 16777216.0;
}

@inline
function hash(x: i32, y: i32): f64 {
  let value = <f64>(x * 127 + y * 311 + 1013);
  value = Math.sin(value) * 43758.5453123;
  return value - Math.floor(value);
}

@inline
function fade(value: f64): f64 {
  return value * value * (3.0 - 2.0 * value);
}

@inline
function mix(a: f64, b: f64, amount: f64): f64 {
  return a + (b - a) * amount;
}

function terrainNoise(x: i32, y: i32): f64 {
  const scale: f64 = 4.0;
  const sampleX = <f64>x / scale;
  const sampleY = <f64>y / scale;
  const x0 = <i32>Math.floor(sampleX);
  const y0 = <i32>Math.floor(sampleY);
  const fx = fade(sampleX - <f64>x0);
  const fy = fade(sampleY - <f64>y0);
  const top = mix(hash(x0, y0), hash(x0 + 1, y0), fx);
  const bottom = mix(hash(x0, y0 + 1), hash(x0 + 1, y0 + 1), fx);
  return mix(top, bottom, fy);
}

function smoothCave(): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 0; x < GRID_RES; x++) {
      for (let y = 0; y < GRID_RES; y++) {
        const cell = index(x, y);
        if (x === 0 || y === 0 || x === GRID_RES - 1 || y === GRID_RES - 1) {
          unchecked(nextGrid[cell] = 1);
          continue;
        }
        let neighbours = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            neighbours += unchecked(grid[index(x + dx, y + dy)]);
          }
        }
        unchecked(nextGrid[cell] = neighbours > 4 ? 1 : 0);
      }
    }
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      unchecked(grid[cell] = nextGrid[cell]);
    }
  }
}

/** Keep only the largest connected open region, matching the original cave rule. */
function ensureConnectivity(): void {
  for (let cell = 0; cell < CELL_COUNT; cell++) unchecked(visited[cell] = 0);

  let largestSize = 0;
  for (let x = 0; x < GRID_RES; x++) {
    for (let y = 0; y < GRID_RES; y++) {
      const start = index(x, y);
      if (unchecked(grid[start]) !== 0 || unchecked(visited[start]) !== 0) continue;

      let head = 0;
      let size = 0;
      queueTail = 0;
      unchecked(queue[queueTail++] = start);
      unchecked(visited[start] = 1);

      while (head < queueTail) {
        const cell = unchecked(queue[head++]);
        unchecked(region[size++] = cell);
        const cx = cell / GRID_RES;
        const cy = cell % GRID_RES;
        if (cx > 0) enqueueOpen(cx - 1, cy);
        if (cx < GRID_RES - 1) enqueueOpen(cx + 1, cy);
        if (cy > 0) enqueueOpen(cx, cy - 1);
        if (cy < GRID_RES - 1) enqueueOpen(cx, cy + 1);
      }

      if (size > largestSize) {
        largestSize = size;
        for (let i = 0; i < size; i++) unchecked(largestRegion[i] = region[i]);
      }
    }
  }

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (unchecked(grid[cell]) === 0) unchecked(grid[cell] = 1);
  }
  for (let i = 0; i < largestSize; i++) unchecked(grid[largestRegion[i]] = 0);
}

// AssemblyScript has no closures over an in/out queue pointer, so the flood fill
// keeps its queue cursor inside this module rather than exposing it to callers.
let queueTail: i32 = 0;
function enqueueOpen(x: i32, y: i32): void {
  const cell = index(x, y);
  if (unchecked(grid[cell]) === 0 && unchecked(visited[cell]) === 0) {
    unchecked(visited[cell] = 1);
    unchecked(queue[queueTail++] = cell);
  }
}

function assignMaterials(): void {
  for (let x = 0; x < GRID_RES; x++) {
    for (let y = 0; y < GRID_RES; y++) {
      const cell = index(x, y);
      let material = 0;
      if (unchecked(grid[cell]) === 1) {
        const cluster = terrainNoise(x, y);
        const exposedTop = y > 0 && unchecked(grid[index(x, y - 1)]) === 0;
        if (y >= WATER_ROW) material = 3;
        else if (exposedTop && cluster > 0.72) material = 2;
        else if (cluster > 0.50 && cluster < 0.68) material = 1;
      }
      unchecked(materials[cell] = material);
    }
  }
}

/** Generate a reproducible connected cave and its stable terrain materials. */
export function generateWorld(seed: u32): void {
  randomState = seed == 0 ? 1 : seed;
  for (let x = 0; x < GRID_RES; x++) {
    for (let y = 0; y < GRID_RES; y++) {
      const border = x === 0 || y === 0 || x === GRID_RES - 1 || y === GRID_RES - 1;
      const cell = index(x, y);
      // The JavaScript generator starts with rock, then opens a cell when its
      // random roll exceeds 0.42. Keep the same distribution here: 0 is open
      // space and 1 is rock.
      unchecked(grid[cell] = border || random() <= 0.42 ? 1 : 0);
      unchecked(damage[cell] = 0);
    }
  }
  smoothCave();
  ensureConnectivity();
  assignMaterials();
}

/** 0 means empty; 1 means hit but intact; 2 means destroyed. */
export function damageTile(x: i32, y: i32, hitsToDestroy: i32): i32 {
  if (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) return 0;
  const cell = index(x, y);
  if (unchecked(grid[cell]) !== 1) return 0;
  unchecked(damage[cell] = unchecked(damage[cell]) + 1);
  if (unchecked(damage[cell]) >= hitsToDestroy) {
    unchecked(grid[cell] = 0);
    unchecked(damage[cell] = 0);
    return 2;
  }
  return 1;
}

export function getTile(x: i32, y: i32): i32 {
  return (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) ? 1 : unchecked(grid[index(x, y)]);
}

export function getMaterial(x: i32, y: i32): i32 {
  return (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) ? 0 : unchecked(materials[index(x, y)]);
}

export function getDamage(x: i32, y: i32): i32 {
  return (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) ? 0 : unchecked(damage[index(x, y)]);
}
