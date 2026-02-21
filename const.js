
// --- 30x30 Tile Config ---
const GRID_RES = 30;
const WORLD_SIZE = 3000;
const TILE_SIZE = WORLD_SIZE / GRID_RES; // 100px per tile
const WATER_Y = WORLD_SIZE * 0.6;

// --- Physics ---
const GRAVITY = 0.075;
const BUOYANCY = -0.07;
const AIR_DRAG = 0.98;
const WATER_DRAG = 0.97;
const RAD_2_DEG = 57.29578;
const FUEL_CONSUMPTION = 0.01
const REFUEL_SPEED = 0.5
const MAX_FUEL = 100;
const BASE_COLOR = '#404080'
const BASE_COLOR_SMALL_MAP = '#4040f0'

// fuel gauge location
const FUEL_X = 85;
const FUEL_Y = 81;
const FUEL_HEIGHT = 10
const FUEL_WIDTH = 100

// ammo gauge
const AMMO_X = 85;
const AMMO_Y = 101;
const AMMO_HEIGHT = 10
const AMMO_WIDTH = 100

// ammo constants
const REARM_SPEED = 5;
const MAX_AMMO = 1000;
const MAX_BULLETS_AT_ONCE = 100;
const AMMO_SPEED = 8;
const AMMO_TTL = 100;
