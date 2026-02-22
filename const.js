
// --- 30x30 Tile Config ---
const GRID_RES = 30;                        // size of each tile in the world
const WORLD_SIZE = 3000;                    // the entire size of the world
const TILE_SIZE = WORLD_SIZE / GRID_RES;    // 100px per tile
const WATER_Y = WORLD_SIZE * 0.6;           // water top level

// --- Physics ---
const GRAVITY = 0.075;                  // downwards pressure on flying
const BUOYANCY = -0.07;                 // upwards pressure under-water
const AIR_DRAG = 0.98;                  // speed loss multiplier
const WATER_DRAG = 0.97;                // underwater speed loss multiplier
const RAD_2_DEG = 57.29578;             // conversion of radians to degrees
const FUEL_CONSUMPTION = 0.01           // fuel consumption unit per action
const REFUEL_SPEED = 0.5                // speed of refuel on launchpad
const MAX_FUEL = 100;                   // fuel level
const BASE_COLOR = '#404080'             // colour of our base block
const BASE_COLOR_SMALL_MAP = '#4040f0'   // colour of the base block in the small map

// fuel gauge location on screen
const FUEL_X = 85;
const FUEL_Y = 81;
const FUEL_HEIGHT = 10
const FUEL_WIDTH = 100

// ammo gauge location on screen
const AMMO_X = 85;
const AMMO_Y = 101;
const AMMO_HEIGHT = 10
const AMMO_WIDTH = 100

// the mini-ship number of lives start display
const LIVES_X = 80
const LIVES_Y = 138

// ammo constants
const REARM_SPEED = 5;              // how fast we re-arm on the launchpad
const MAX_AMMO = 1000;              // maximum number of ammo
const MAX_BULLETS_AT_ONCE = 100;    // maximum number of bullets fired at once
const AMMO_SPEED = 8;               // speed of bullets
const AMMO_TTL = 100;               // how long the bullets last
