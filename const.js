
// --- 30x30 Tile Config ---
const GRID_RES = 30;                        // size of each tile in the world
const WORLD_SIZE = 3000;                    // the entire size of the world
const TILE_SIZE = WORLD_SIZE / GRID_RES;    // 100px per tile
const WATER_Y = WORLD_SIZE * 0.6;           // water top level
const BUBBLE_COUNT = 60;                    // number of bubbles in the water

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
const NEXT_LEVEL_COLOR = '#408040'       // colour of our next level block
const BASE_COLOR_SMALL_MAP = '#4040f0'   // colour of the base block in the small map
const NEXT_LEVEL_COLOR_SMALL_MAP = '#40f040'   // colour of the finish block in the small map

const ORB_SCORE = 1000;                 // 1K per orb
const NEXT_LEVEL_SCORE_FULL = 10000;    // 10K for next level with all orbs collected
const NEXT_LEVEL_SCORE = 1000;          // 1K for next level without all orbs collected

// fuel gauge location on screen (x,y, width, height)
const FUEL_X = 85;
const FUEL_Y = 81;
const FUEL_HEIGHT = 10
const FUEL_WIDTH = 100

// ammo gauge location on screen (x, y, width, height)
const AMMO_X = 85;
const AMMO_Y = 101;
const AMMO_HEIGHT = 10
const AMMO_WIDTH = 100

// the mini-ship number of lives start display
const LIVES_X = 80
const LIVES_Y = 138

// the orb number display
const ORBS_X = 80
const ORBS_Y = 158

// ammo constants
const REARM_SPEED = 5;              // how fast we re-arm on the launchpad
const MAX_AMMO = 1000;              // maximum number of ammo
const MAX_BULLETS_AT_ONCE = 100;    // maximum number of bullets fired at once
const AMMO_SPEED = 8;               // speed of bullets
const AMMO_TTL = 100;               // how long the bullets last on the map

// sound constants
const POOL_SIZE = 10;               // repeated sound pool size

// --- Game speed ---
// All the physics is per-frame, so the rate we step the logic at *is* the speed of the
// game.  Stepping at a fraction of the usual 60Hz slows the whole thing down by that
// much without touching a single gravity, thrust or drag constant - the ship handles
// exactly as it always did, just at a different pace.  GAME_SPEED is the only dial:
// 1.0 is the original speed, lower is calmer, higher is more frantic.
const GAME_SPEED = 0.75;                    // fraction of full speed to play at
const LOGIC_FPS = 60 * GAME_SPEED;          // 45 logic steps a second
const LOGIC_STEP_MS = 1000 / LOGIC_FPS;     // ~22.2ms of real time per step
const MAX_FRAME_MS = 250;                   // after a stall, never fast-forward more than this

// --- Enemy AI opponent: appearance ---
const ENEMY_COLOR = '#f44';                     // enemy hull colour (the player is white)
const ENEMY_FLAME_COLOR = '#fa0';               // its engine flame
const ENEMY_BULLET_COLOR = '#f0f';              // apart from player yellow and turret cyan
const ENEMY_BASE_COLOR = '#804040';             // colour of its launch pad block
const ENEMY_BASE_COLOR_SMALL_MAP = '#f04040';   // its launch pad on the mini-map
const ENEMY_SCORE = 5000;                       // score for shooting the enemy down
const ENEMY_DEBUG_PATH = false;                 // draw the AI's planned route (development aid)

// --- Enemy AI: placement and lifecycle ---
const ENEMY_MIN_PAD_DIST = 6;       // tiles its pad must keep away from the player's home
const ENEMY_LAUNCH_DELAY = 90;      // frames it sits on the pad before taking off
const ENEMY_RESPAWN_DELAY = 240;    // frames before it comes back after being destroyed
const ENEMY_REFUEL_LEVEL = 25;      // fuel level at which it heads home to refuel

// --- Enemy AI: the planner (its own slower clock) ---
const ENEMY_PLAN_INTERVAL = 6;      // frames between route re-plans (~10Hz)
const ENEMY_CLEARANCE_WEIGHT = 4.0; // how much extra A* pays to squeeze past rock
const ENEMY_WAYPOINT_RADIUS = 55;   // how close counts as "reached this waypoint"

// --- Enemy AI: the flight controller (every frame) ---
const ENEMY_ARRIVE_GAIN = 0.03;     // desired speed per pixel of position error
const ENEMY_VEL_GAIN = 0.30;        // gain on velocity error (the damping term)
const ENEMY_CMD_SMOOTH = 0.25;      // low-pass on the thrust command, the hull turns slowly
const ENEMY_MAX_SPEED = 4.0;        // absolute speed cap
const ENEMY_MIN_SPEED = 1.0;        // never crawl slower than this
const ENEMY_SPEED_PER_CLEARANCE = 1.6;  // speed allowance per tile of elbow room
const ENEMY_MAX_SINK = 1.8;         // dropping faster than this the way the medium pulls is urgent
const ENEMY_ANGLE_DEADBAND = 0.045; // don't chase the last fraction of a radian
// The hull only turns 0.04 rad a frame, so a narrow cone leaves it coasting with no
// control at all for seconds at a time.  At 1.0 rad more than half the burn still goes
// where it's wanted, which beats not burning.
const ENEMY_THRUST_CONE = 1.0;      // burn when the nose is within this of the wanted push
const ENEMY_THRUST_MIN = 0.02;      // ignore trivially small thrust demands

// --- Enemy AI: not flying into the cave ---
const ENEMY_PROBE_SAFETY = 1.5;     // safety factor on the coasting distance it looks ahead
const ENEMY_MIN_PROBE = 130;        // px, never look less than about a tile ahead
const ENEMY_MAX_PROBE = 420;        // px, and never further than this
const ENEMY_TURN_DELAY = 24;       // frames of turning to allow for before a burn bites
const ENEMY_BRAKE_GAIN = 0.45;      // how hard it burns to kill velocity aimed at a wall
const ENEMY_AVOID_RADIUS = 220;     // px at which the repulsive field switches on
const ENEMY_REPULSION = 60000;      // strength of that repulsive field
const ENEMY_REPULSION_MAX = 1.5;    // clamped, so the barrier can't drown out everything else

// --- Enemy AI: weapons ---
const ENEMY_FIRE_RANGE = 700;       // px at which it starts looking for a shot
const ENEMY_AIM_TOLERANCE = 0.11;   // radians of aim error it will accept before firing
const ENEMY_FIRE_COOLDOWN = 9;      // frames between shots
const ENEMY_STANDOFF_MIN = 220;     // it tries to hold at least this far from the player...
const ENEMY_STANDOFF_MAX = 420;     // ...and no further away than this
const ENEMY_EVADE_DIST = 150;       // any closer and it breaks away (a touch kills them both)

// --- Enemy AI: landing back on its own pad ---
const ENEMY_LAND_ALIGN = 26;        // px of horizontal slop allowed on the final descent
const ENEMY_LAND_SPEED = 1.1;       // fastest it will let itself drop on the way down
