
// the AI's high-level intents.  The planner picks one of these a few times a second;
// the flight controller below reads it every frame and works out what to do about it.
const MODE_LAUNCH = 'LAUNCH';   // sat on its pad, waiting to go
const MODE_HUNT   = 'HUNT';     // routing across the cave towards the player
const MODE_ATTACK = 'ATTACK';   // in range with a clear view - hold off and shoot
const MODE_EVADE  = 'EVADE';    // too close for comfort, break away
const MODE_REFUEL = 'REFUEL';   // low on fuel or ammo, going home to land
const MODE_HOLD   = 'HOLD';     // the player is gone, just hover


/**
 * The AI opponent - the same ship as the player in a different colour, flown by a
 * computer instead of a keyboard.
 *
 * It is built as two layers running at two different rates, which is how real
 * autonomy stacks are put together:
 *
 *   plan()    - the deliberative layer, every ENEMY_PLAN_INTERVAL frames.  Slow, global
 *               and discrete: decide what we are trying to do, and route through the
 *               cave with A*.  It writes a mode and a list of waypoints.
 *   control() - the reactive layer, every single frame.  Fast, local and continuous:
 *               a PD controller on velocity, a repulsive field to stay off the rock,
 *               and the trigger discipline.  It only reads what the planner wrote.
 *
 * That split is the "planning thread".  It is not an actual Worker: the game is meant
 * to run by opening index.html straight off disk, and a file:// page has a null origin,
 * where browsers refuse to start workers.  Slicing the expensive work across frames
 * gets the same result with no server and no build step.
 */
class Enemy {

    constructor() {
        this.x = 0;                 // location in the world
        this.y = 0;
        this.vx = 0;                // speed
        this.vy = 0;

        this.angle = -Math.PI / 2;  // nose angle, pointing up
        this.rotationSpeed = 0.04;  // identical hull to the player's ship...
        this.thrust = 0.16;         // ...so identical handling
        this.size = 10;
        this.fuel = 0.0;
        this.ammo = 0;
        this.landed = true;
        this.dead = false;

        this.pad_x = 0;             // its own launch pad, nowhere near the player's
        this.pad_y = 0;

        this.bullets = [];          // its shots in flight
        this.particles = [];        // its explosion
        this.fireCooldown = 0;
        this.respawnTimer = 0;
        this.thrusting = false;     // for drawing the flame

        this.nav = new Nav();       // what it knows about the cave
        this.terrainRevision = -1;  // revision used to build the current clearance field
        this.mode = MODE_LAUNCH;
        this.path = [];             // waypoints from the planner, world coordinates
        this.planTick = 1;          // frames until the planner next runs
        this.launchTimer = 0;
        this.landPhase = 'approach';// 'approach' or 'descend' when going home
        this.aim = null;            // the current firing solution
        this.cmdX = 0;              // smoothed thrust command, so the nose has something
        this.cmdY = 0;              // steady to track
    }

    /**
     * place the enemy on its own launch pad, fuelled and armed.
     *
     * The pad has to satisfy the same shape test the player's home does - a solid block
     * with two empty tiles above it - plus: above the water line so it can actually take
     * off, clear of both the player's home and the level exit, and as far from the
     * player's home as the cave allows.  Taking the farthest candidate makes the choice
     * deterministic and puts it reliably in a different part of the map.
     *
     * @param map the map to place into
     * @param ship the player, whose home and exit blocks we must avoid
     * @returns {boolean} true if a pad was found
     */
    reset(map, ship) {
        this.nav.computeClearance(map.grid); // learn this cave
        this.terrainRevision = map.terrainRevision;

        let best = null;
        let bestDistance = -1;
        for (let x = 1; x < GRID_RES - 1; x++) {
            for (let y = 3; y < GRID_RES - 1; y++) {
                // a solid block with room to sit and take off above it
                if (map.grid[x][y] !== 1) continue;
                if (map.grid[x][y - 1] !== 0 || map.grid[x][y - 2] !== 0) continue;
                // it has to launch in air, not water
                if (y * TILE_SIZE >= WATER_Y) continue;
                // never the player's home block or the level exit
                if (x === ship.home_x && y === ship.home_y) continue;
                if (x === ship.end_x && y === ship.end_y) continue;

                const dx = x - ship.home_x;
                const dy = y - ship.home_y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < ENEMY_MIN_PAD_DIST) continue; // too close to the player

                // and don't camp the exit either
                const ex = x - ship.end_x;
                const ey = y - ship.end_y;
                if (Math.sqrt(ex * ex + ey * ey) < 2) continue;

                if (distance > bestDistance) {
                    bestDistance = distance;
                    best = { x: x, y: y };
                }
            }
        }
        if (best === null) return false; // this cave has nowhere for it to live

        this.pad_x = best.x;
        this.pad_y = best.y;
        this.x = this.pad_x * TILE_SIZE + TILE_SIZE / 2;
        this.y = (this.pad_y - 1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
        this.vx = 0;
        this.vy = 0;
        this.angle = -Math.PI / 2;
        this.landed = true;
        this.dead = false;
        this.fuel = MAX_FUEL;       // starts every life at 100% fuel...
        this.ammo = MAX_AMMO;       // ...and 100% ammo
        this.bullets = [];
        this.particles = [];
        this.path = [];
        this.mode = MODE_LAUNCH;
        this.launchTimer = ENEMY_LAUNCH_DELAY;
        this.planTick = 1;
        this.fireCooldown = 0;
        this.respawnTimer = 0;
        this.thrusting = false;
        this.landPhase = 'approach';
        this.aim = null;
        this.cmdX = 0;
        this.cmdY = 0;
        return true;
    }

    /**
     * the enemy's frame.  Two clocks: the planner on its own slow one, the controller
     * and the physics on every tick.
     *
     * @param map the world
     * @param ship the player
     * @param player the sound system
     */
    update(map, ship, player) {
        this.updateParticles();
        this.updateBullets(map, ship, player);

        // destroyed - just count down to coming back
        if (this.dead) {
            if (this.respawnTimer > 0) {
                this.respawnTimer--;
            } else if (!gameOver) {
                this.reset(map, ship);
            }
            return;
        }

        this.checkPlayerBullets(ship, player);
        if (this.dead) return; // that shot got us

        // --- the planning layer, time-sliced onto its own clock ---
        this.planTick--;
        if (this.planTick <= 0) {
            this.planTick = ENEMY_PLAN_INTERVAL;
            this.plan(map, ship);
        }

        // --- the reactive layer, every frame ---
        this.aim = this.aimSolution(map, ship);
        this.applyControls(this.control(map, ship), player);
        this.physics(map, ship, player);
    }

    /**
     * the deliberative layer: decide what we're doing, and route there.
     * @param map the world
     * @param ship the player
     */
    plan(map, ship) {
        // Player mining can open a new route; refresh only when the terrain changed.
        if (this.terrainRevision !== map.terrainRevision) {
            this.nav.computeClearance(map.grid);
            this.terrainRevision = map.terrainRevision;
        }
        // the player is dead or between lives - stop hunting a ghost and just hover
        if (gameOver) {
            this.mode = MODE_HOLD;
            this.path = [];
            return;
        }

        // still on the pad counting down to launch
        if (this.mode === MODE_LAUNCH) {
            this.launchTimer -= ENEMY_PLAN_INTERVAL;
            if (this.launchTimer > 0) return;
            this.mode = MODE_HUNT;
        }

        // dry or empty? break off and go home.  Once we've topped up, launch again.
        if (this.mode !== MODE_REFUEL && (this.fuel < ENEMY_REFUEL_LEVEL || this.ammo <= 0)) {
            this.mode = MODE_REFUEL;
            this.landPhase = 'approach';
        }
        if (this.mode === MODE_REFUEL) {
            this.planRefuel(map);
            return;
        }

        const dx = ship.x - this.x;
        const dy = ship.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const canSee = this.nav.rayClear(map.grid, this.x, this.y, ship.x, ship.y);

        if (distance < ENEMY_EVADE_DIST) {
            // touching the player kills us both, so back off and shoot from a distance
            this.mode = MODE_EVADE;
            const away = Math.max(1, distance);
            this.retarget(map, this.x + (this.x - ship.x) / away * 220,
                               this.y + (this.y - ship.y) / away * 220);

        } else if (distance < ENEMY_FIRE_RANGE && canSee) {
            this.mode = MODE_ATTACK;
            // hold the middle of the standoff band, on the line between us
            const hold = (ENEMY_STANDOFF_MIN + ENEMY_STANDOFF_MAX) / 2;
            const away = Math.max(1, distance);
            this.retarget(map, ship.x + (this.x - ship.x) / away * hold,
                               ship.y + (this.y - ship.y) / away * hold);

        } else {
            this.mode = MODE_HUNT;
            this.retarget(map, ship.x, ship.y);
        }
    }

    /**
     * going home to refuel.  Landing this hull is fiddly: thrust only acts along the
     * nose, so with the nose up the engine can only push straight up and sideways drift
     * cannot be corrected.  It therefore has to arrive over the pad and stop before it
     * starts down - hence two phases.
     *
     * @param map the world
     */
    planRefuel(map) {
        // sat on the pad with full tanks - go again
        if (this.landed && this.fuel >= MAX_FUEL * 0.99 && this.ammo >= MAX_AMMO) {
            this.mode = MODE_LAUNCH;
            this.launchTimer = ENEMY_LAUNCH_DELAY;
            this.path = [];
            return;
        }

        const hover = this.hoverPoint();
        const dx = this.x - hover.x;
        const dy = this.y - hover.y;
        const offset = Math.sqrt(dx * dx + dy * dy);
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        if (this.landPhase === 'approach') {
            // parked above the pad and nearly stopped? start down
            if (offset < 45 && speed < 0.8) {
                this.landPhase = 'descend';
                this.path = [];
                return;
            }
            this.retarget(map, hover.x, hover.y);
        } else {
            // drifted out of the pad's column - go round and line up again
            if (Math.abs(this.x - hover.x) > ENEMY_LAND_ALIGN * 2.5) {
                this.landPhase = 'approach';
                this.retarget(map, hover.x, hover.y);
            } else {
                this.path = []; // the descent controller flies this bit by hand
            }
        }
    }

    /**
     * the station-keeping point above its own pad, two tiles up (both guaranteed empty
     * by the pad test in reset)
     * @returns {{x: number, y: number}} world coordinates
     */
    hoverPoint() {
        return {
            x: this.pad_x * TILE_SIZE + TILE_SIZE / 2,
            y: (this.pad_y - 2) * TILE_SIZE + TILE_SIZE / 2
        };
    }

    /**
     * work out a route to a point in the world.  If we can simply see the place there's
     * no need to search at all - which is the common case in a fight, and keeps A* off
     * the hot path.
     *
     * @param map the world
     * @param goalX target x in world coordinates
     * @param goalY target y in world coordinates
     */
    retarget(map, goalX, goalY) {
        // straight run? then that's the whole plan
        if (this.nav.corridorClear(map.grid, this.x, this.y, goalX, goalY, this.size)) {
            this.path = [{ x: goalX, y: goalY }];
            return;
        }

        const goalTileX = Math.floor(goalX / TILE_SIZE);
        const goalTileY = Math.floor(goalY / TILE_SIZE);
        // the target may be sitting in rock (a standoff point behind a wall, say)
        const open = this.nav.nearestOpen(map.grid, goalTileX, goalTileY, 3);
        if (open === null) {
            this.path = [];
            return;
        }

        const startX = Math.floor(this.x / TILE_SIZE);
        const startY = Math.floor(this.y / TILE_SIZE);
        const tiles = this.nav.findPath(map.grid, startX, startY, open.x, open.y);
        if (tiles === null || tiles.length < 2) {
            this.path = [];
            return;
        }

        // drop the tile we're standing in, then pull the staircase taut
        this.path = this.nav.smoothPath(map.grid, tiles.slice(1), this.x, this.y, this.size);
        // finish on the real target rather than the centre of its tile
        if (open.x === goalTileX && open.y === goalTileY) {
            this.path.push({ x: goalX, y: goalY });
        }
    }

    /**
     * the waypoint we are currently flying at, dropping any we've reached or can
     * already see past
     * @param map the world
     * @returns {{x: number, y: number}|null} the next waypoint, or null if there's no plan
     */
    currentWaypoint(map) {
        while (this.path.length > 1) {
            const wp = this.path[0];
            const dx = wp.x - this.x;
            const dy = wp.y - this.y;
            const reached = Math.sqrt(dx * dx + dy * dy) < ENEMY_WAYPOINT_RADIUS;
            // if the one after it is already in plain sight, cut the corner
            const shortcut = this.nav.corridorClear(map.grid, this.x, this.y,
                                                    this.path[1].x, this.path[1].y, this.size);
            if (reached || shortcut) this.path.shift();
            else break;
        }
        return this.path.length > 0 ? this.path[0] : null;
    }

    /**
     * how fast it is willing to fly right here.  Speed is rationed by the clearance
     * field: full pelt across a cavern, a crawl down a crack.  Most crashes in a game
     * like this are really just "went too fast for the room available".
     *
     * @returns {number} the speed cap in pixels per frame
     */
    speedLimit() {
        const room = this.nav.clearanceAt(Math.floor(this.x / TILE_SIZE), Math.floor(this.y / TILE_SIZE));
        return Math.max(ENEMY_MIN_SPEED, Math.min(ENEMY_MAX_SPEED, ENEMY_SPEED_PER_CLEARANCE * room));
    }

    /**
     * the repulsive half of a potential field.  Every piece of rock within
     * ENEMY_AVOID_RADIUS pushes the ship away, with the classic Khatib gradient:
     *
     *      a = k (1/d - 1/R) / d^2
     *
     * which is exactly zero at the edge of the radius - so it never disturbs ordinary
     * flight - and grows without bound as the gap closes, so it always wins in a
     * squeeze.  Distance is measured to the nearest point on the block, not its centre,
     * because at 100px a tile these are very different numbers.
     *
     * @param map the world
     * @returns {{x: number, y: number}} an acceleration to add to the command
     */
    repulsion(map) {
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);
        const reach = Math.ceil(ENEMY_AVOID_RADIUS / TILE_SIZE);
        let ax = 0;
        let ay = 0;

        for (let x = gx - reach; x <= gx + reach; x++) {
            for (let y = gy - reach; y <= gy + reach; y++) {
                if (!Nav.isSolid(map.grid, x, y)) continue;

                // nearest point on this block to us
                const px = Math.max(x * TILE_SIZE, Math.min(this.x, (x + 1) * TILE_SIZE));
                const py = Math.max(y * TILE_SIZE, Math.min(this.y, (y + 1) * TILE_SIZE));
                let ox = this.x - px;
                let oy = this.y - py;
                let d = Math.sqrt(ox * ox + oy * oy);
                if (d > ENEMY_AVOID_RADIUS) continue;

                if (d < 1e-3) {
                    // touching, or inside - push out from the block's centre instead
                    ox = this.x - (x * TILE_SIZE + TILE_SIZE / 2);
                    oy = this.y - (y * TILE_SIZE + TILE_SIZE / 2);
                    d = Math.sqrt(ox * ox + oy * oy);
                    if (d < 1e-3) { ox = 0; oy = -1; d = 1; }
                }

                // the outward normal - the direction the block wants to push us
                const nx = ox / d;
                const ny = oy / d;

                // the static barrier
                const magnitude = ENEMY_REPULSION * (1 / d - 1 / ENEMY_AVOID_RADIUS) / (d * d);
                ax += magnitude * nx;
                ay += magnitude * ny;

                // ...and the derivative half of it.  A position-only field always
                // overshoots when the engine is weak, so also ask the question that
                // actually matters: closing on this block at `closing`, with `gap` left,
                // stopping needs a deceleration of v^2/2s.  That grows exactly as fast
                // as the situation deteriorates, and it starts pushing while there is
                // still room to do something about it.
                const closing = -(this.vx * nx + this.vy * ny);
                if (closing > 0) {
                    // The gap is not simply the distance left.  This ship's binding
                    // constraint is not thrust, it is how long it takes to swing the
                    // nose round to point the engine at the problem - and it keeps
                    // drifting the whole time it turns.  Charge that travel against the
                    // gap and the ship starts correcting while it still can.
                    // floored well above zero: the demand should be able to saturate the
                    // engine when things are dire, but not explode discontinuously
                    const gap = Math.max(4, d - this.size - closing * ENEMY_TURN_DELAY);
                    const needed = (closing * closing) / (2 * gap);
                    ax += needed * nx;
                    ay += needed * ny;
                }
            }
        }

        // clamp it - a barrier, not a bulldozer
        const total = Math.sqrt(ax * ax + ay * ay);
        if (total > ENEMY_REPULSION_MAX) {
            ax = ax / total * ENEMY_REPULSION_MAX;
            ay = ay / total * ENEMY_REPULSION_MAX;
        }
        return { x: ax, y: ay };
    }

    /**
     * where momentum is taking us.  With this much inertia, noticing a wall on contact
     * is far too late - so probe forward along the current velocity and report how far
     * along that probe the rock is.
     *
     * How far to look is not a guess.  If the engine were never touched again, drag
     * alone would still carry the ship
     *
     *      sum over k of |v| * drag^k  =  |v| * drag / (1 - drag)
     *
     * which in air is about fifty times its current speed.  That coasting distance -
     * not some fixed number of frames - is the room the ship genuinely needs, and it
     * scales itself: quick when it's dawdling, a long way when it's moving.
     *
     * @param map the world
     * @returns {number} fraction of the probe at which we'd hit (0..1), or -1 if clear
     */
    predictCollision(map) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed < 1e-4) return -1; // going nowhere, nothing to hit

        const drag = (this.y > WATER_Y) ? WATER_DRAG : AIR_DRAG;
        const coast = speed * drag / (1 - drag);
        const reach = Math.max(ENEMY_MIN_PROBE, Math.min(ENEMY_MAX_PROBE, coast * ENEMY_PROBE_SAFETY));

        const dirX = this.vx / speed;
        const dirY = this.vy / speed;
        // sample about every quarter tile so a thin wall can't slip between samples
        const steps = Math.max(4, Math.min(24, Math.ceil(reach / (TILE_SIZE / 4))));
        for (let i = 1; i <= steps; i++) {
            const f = i / steps;
            const sx = this.x + dirX * reach * f;
            const sy = this.y + dirY * reach * f;
            if (Nav.isSolid(map.grid, Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE))) {
                return f;
            }
        }
        return -1;
    }

    /**
     * the reactive layer - turn the planner's waypoint into rotate/thrust/fire.
     *
     * @param map the world
     * @param ship the player
     * @returns {{left: boolean, right: boolean, thrust: boolean, fire: boolean}} controls
     */
    control(map, ship) {
        const ctrl = { left: false, right: false, thrust: false, fire: false };

        // sitting on the pad refuelling, or waiting to launch - hands off the controls
        if (this.landed && (this.mode === MODE_REFUEL ||
                           (this.mode === MODE_LAUNCH && this.launchTimer > 0))) {
            return ctrl;
        }

        // the final descent onto its own pad is flown by a dedicated controller
        if (this.mode === MODE_REFUEL && this.landPhase === 'descend') {
            return this.controlDescent(ctrl);
        }

        const inWater = this.y > WATER_Y;
        const gravity = inWater ? BUOYANCY : GRAVITY;
        const drag = inWater ? WATER_DRAG : AIR_DRAG;

        // --- where do we want to be going? ---
        const vMax = this.speedLimit();
        let vdx = 0;
        let vdy = 0;
        const goal = this.currentWaypoint(map);
        if (goal !== null && this.mode !== MODE_HOLD) {
            const ex = goal.x - this.x;
            const ey = goal.y - this.y;
            const error = Math.sqrt(ex * ex + ey * ey);
            if (error > 1e-3) {
                // "arrive": flat out when far away, easing to a stop on the mark
                const speed = Math.min(vMax, ENEMY_ARRIVE_GAIN * error);
                vdx = ex / error * speed;
                vdy = ey / error * speed;
                // never *plan* to fall faster than it can pull out of - a dive is easy
                // to start and takes the best part of a second of turning to stop
                if (inWater) vdy = Math.max(vdy, -ENEMY_MAX_SINK);
                else vdy = Math.min(vdy, ENEMY_MAX_SINK);
            }
        }

        // --- the controller proper.  Acting on the velocity error makes this the
        //     derivative term of a PD loop on position: it damps, so the ship settles
        //     onto a waypoint instead of swinging past it. ---
        let ax = ENEMY_VEL_GAIN * (vdx - this.vx);
        let ay = ENEMY_VEL_GAIN * (vdy - this.vy);

        // --- stay off the rock ---
        const push = this.repulsion(map);
        ax += push.x;
        ay += push.y;
        const impact = this.predictCollision(map);
        if (impact >= 0) {
            // squared, so rock at the far end of the probe barely registers and rock
            // right in front of us gets everything the engine has
            const urgency = 0.4 + 1.6 * (1 - impact) * (1 - impact);
            ax -= this.vx * ENEMY_BRAKE_GAIN * urgency;
            ay -= this.vy * ENEMY_BRAKE_GAIN * urgency;
        }

        // --- cancel out the medium we're flying in ---
        // The engine adds `gravity` to vy and then multiplies by `drag` every frame, so
        // to actually achieve the acceleration we asked for, the thrust vector has to
        // pay for both.  Note what this does under water: BUOYANCY is NEGATIVE - it
        // lifts - so below the water line this term changes sign, the wanted thrust
        // flips from up to down, and the ship pitches over and thrusts downwards to hold
        // its depth.  The reversal is not a special case; it falls out of the physics.
        let tx = ax + this.vx * (1 - drag);
        let ty = ay - gravity + this.vy * (1 - drag);

        // Gravity is free.  There is never any reason to burn in the direction the
        // medium is already dragging us, and doing so is actively dangerous: it points
        // the nose the wrong way, and this hull needs the better part of eighty frames
        // to turn round.  Clamping that component keeps the nose permanently in the
        // half-plane that can fight the medium - which in air means it always sits
        // somewhere between up-left and up-right, and under water, where BUOYANCY
        // pulls the other way, always between down-left and down-right.
        if (gravity > 0 && ty > 0) ty = 0;      // in air, never thrust downwards
        else if (gravity < 0 && ty < 0) ty = 0; // in water, never thrust upwards

        // the hull only turns at 0.04 rad a frame, so give the nose a target that isn't
        // whipping about - a low-pass on the command it's chasing
        this.cmdX += (tx - this.cmdX) * ENEMY_CMD_SMOOTH;
        this.cmdY += (ty - this.cmdY) * ENEMY_CMD_SMOOTH;
        tx = this.cmdX;
        ty = this.cmdY;
        const demand = Math.sqrt(tx * tx + ty * ty);
        const flyAngle = Math.atan2(ty, tx);

        // --- is flying more urgent than shooting right now? ---
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        // "sinking" means being dragged the way the medium pulls - down in air, up in water
        const sink = inWater ? -this.vy : this.vy;
        const critical = (impact >= 0 && impact < 0.6) || speed > vMax * 1.3 ||
                         sink > ENEMY_MAX_SINK ||
                         Math.sqrt(push.x * push.x + push.y * push.y) > 0.15;

        const hasShot = this.aim !== null && this.aim.valid &&
                        (this.mode === MODE_ATTACK || this.mode === MODE_EVADE);
        const aiming = hasShot && !critical;

        // --- point the nose ---
        const want = aiming ? this.aim.angle : flyAngle;
        const error = Nav.angleDiff(this.angle, want);
        if (error > ENEMY_ANGLE_DEADBAND) ctrl.right = true;
        else if (error < -ENEMY_ANGLE_DEADBAND) ctrl.left = true;

        // --- and the throttle ---
        if (aiming) {
            // the nose is on the target, not on the burn we want.  Only fire the engine
            // if those happen to agree, otherwise we'd shove ourselves at the player.
            const flyError = Nav.angleDiff(this.angle, flyAngle);
            ctrl.thrust = demand > ENEMY_THRUST_MIN && Math.abs(flyError) < ENEMY_THRUST_CONE * 0.6;
        } else {
            // thrusting while badly misaligned pushes the wrong way, so normally we wait
            // for the turn - but with rock closing fast, a burn that is only half useful
            // still beats coasting into it
            const cone = (impact >= 0 && impact < 0.5) ? Math.PI / 2 : ENEMY_THRUST_CONE;
            ctrl.thrust = demand > ENEMY_THRUST_MIN && Math.abs(error) < cone;
        }

        ctrl.fire = hasShot && this.fireCooldown <= 0 && this.ammo > 0 &&
                    Math.abs(Nav.angleDiff(this.angle, this.aim.angle)) < ENEMY_AIM_TOLERANCE;
        return ctrl;
    }

    /**
     * the last few metres onto its own pad: hold the nose up so the engine pushes
     * straight up, and throttle against gravity to bleed the descent off with height.
     *
     * @param ctrl the control object to fill in
     * @returns {{left: boolean, right: boolean, thrust: boolean, fire: boolean}} controls
     */
    controlDescent(ctrl) {
        const error = Nav.angleDiff(this.angle, -Math.PI / 2);
        if (error > ENEMY_ANGLE_DEADBAND) ctrl.right = true;
        else if (error < -ENEMY_ANGLE_DEADBAND) ctrl.left = true;

        // slow down the nearer the deck gets
        const padY = (this.pad_y - 1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
        const height = padY - this.y;
        const wantedSink = Math.min(ENEMY_LAND_SPEED, Math.max(0.15, height * 0.02));
        // only worth burning once the nose is actually up
        ctrl.thrust = this.vy > wantedSink && Math.abs(error) < 0.25;
        return ctrl;
    }

    /**
     * the firing solution: where to point so a bullet and the player arrive together.
     *
     * A bullet leaves at AMMO_SPEED along the nose *plus our own velocity* (see
     * Ship.fire), so aiming straight at the player misses whenever either ship is
     * moving.  Writing d for the gap between us and w for the player's velocity
     * relative to ours, a bullet fired now meets them at time t when
     *
     *      | d/t + w | = AMMO_SPEED
     *
     * Substituting s = 1/t turns that into an ordinary quadratic in s,
     *
     *      |d|^2 s^2 + 2(d.w) s + (|w|^2 - AMMO_SPEED^2) = 0
     *
     * whose largest positive root is the soonest interception.  The aim direction is
     * then simply d*s + w, normalised.
     *
     * @param map the world, for checking we won't just shoot a wall
     * @param ship the player
     * @returns {{angle: number, valid: boolean, t: number}} the solution
     */
    aimSolution(map, ship) {
        const dx = ship.x - this.x;
        const dy = ship.y - this.y;
        const solution = { angle: Math.atan2(dy, dx), valid: false, t: 0 };

        if (gameOver || this.dead || this.ammo <= 0) return solution;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > ENEMY_FIRE_RANGE) return solution;

        const wx = ship.vx - this.vx;
        const wy = ship.vy - this.vy;
        const a = dx * dx + dy * dy;
        const b = 2 * (dx * wx + dy * wy);
        const c = wx * wx + wy * wy - AMMO_SPEED * AMMO_SPEED;
        if (a < 1e-6) return solution; // sitting on top of each other

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return solution; // it can outrun our bullets

        const root = Math.sqrt(discriminant);
        const s = Math.max((-b + root) / (2 * a), (-b - root) / (2 * a));
        if (s <= 0) return solution;           // the meeting is in the past

        const t = 1 / s;
        if (t > AMMO_TTL) return solution;     // the shot would expire on the way

        solution.angle = Math.atan2(dy * s + wy, dx * s + wx);
        solution.t = t;
        // don't fire into a wall: check the line to where we think they'll be
        solution.valid = this.nav.rayClear(map.grid, this.x, this.y,
                                           ship.x + ship.vx * t, ship.y + ship.vy * t);
        return solution;
    }

    /**
     * hand the controls to the ship, paying for each of them in fuel exactly as the
     * player's keyboard does
     *
     * @param ctrl what the controller decided
     * @param player the sound system
     */
    applyControls(ctrl, player) {
        this.thrusting = false;
        if (this.fuel <= 0.0) return; // dry - it's a glider now

        if (ctrl.left) {
            this.angle -= this.rotationSpeed;
            this.fuel -= FUEL_CONSUMPTION;
        }
        if (ctrl.right) {
            this.angle += this.rotationSpeed;
            this.fuel -= FUEL_CONSUMPTION;
        }
        if (ctrl.thrust) {
            this.vx += Math.cos(this.angle) * this.thrust;
            if (this.landed) {
                this.landed = false;
                this.vy = -1.0; // the same take-off boost the player gets
            } else {
                this.vy += Math.sin(this.angle) * this.thrust;
            }
            this.fuel -= FUEL_CONSUMPTION;
            this.thrusting = true;
        }
        if (ctrl.fire) this.fire(player);
        if (this.fuel < 0.0) this.fuel = 0.0;
    }

    /**
     * the same physics the player flies under, plus what happens when it stops flying
     * @param map the world
     * @param ship the player
     * @param player the sound system
     */
    physics(map, ship, player) {
        // dual gravity: down in air, up in water
        const inWater = this.y > WATER_Y;
        this.vy += inWater ? BUOYANCY : GRAVITY;
        this.vx *= (inWater ? WATER_DRAG : AIR_DRAG);
        this.vy *= (inWater ? WATER_DRAG : AIR_DRAG);

        if (this.landed) {
            this.vx = 0.0;
            this.vy = 0.0;
            this.angle = -Math.PI / 2;
            if (this.fuel < MAX_FUEL) this.fuel = Math.min(MAX_FUEL, this.fuel + REFUEL_SPEED);
            if (this.ammo < MAX_AMMO) this.ammo = Math.min(MAX_AMMO, this.ammo + REARM_SPEED);
        }

        this.x += this.vx;
        this.y += this.vy;
        if (this.fireCooldown > 0) this.fireCooldown--;

        // landing angle between 0 and 360 degrees, as the player's ship measures it
        const angle_deg = (360 + (Math.ceil((this.angle % (2 * Math.PI)) * RAD_2_DEG))) % 360;

        // touching rock: its own pad nose-up is a landing, anything else is the end
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);
        if (Nav.isSolid(map.grid, gx, gy)) {
            if (gx === this.pad_x && gy === this.pad_y && angle_deg > 230 && angle_deg < 310) {
                this.land();
            } else {
                this.destroy(player);
                return;
            }
        }

        // ramming the player takes them both out
        if (!gameOver && !this.dead) {
            const dx = this.x - ship.x;
            const dy = this.y - ship.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.size + ship.size) {
                this.destroy(player);
                triggerGameOver(player);
            }
        }
    }

    /**
     * the enemy sets down on its own pad
     */
    land() {
        this.vx = 0.0;
        this.vy = 0.0;
        this.angle = -Math.PI / 2;
        this.landed = true;
        // snap onto the middle of the pad - the AI's touchdown is less tidy than a
        // human's, and it has to be centred to take off cleanly again
        this.x = this.pad_x * TILE_SIZE + TILE_SIZE / 2;
        this.y = (this.pad_y - 1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
        this.path = [];
    }

    /**
     * the enemy shoots - identical ballistics to the player's gun
     * @param player the sound system
     */
    fire(player) {
        if (this.bullets.length >= MAX_BULLETS_AT_ONCE) return;
        if (this.ammo <= 0) return;

        this.ammo -= 1;
        this.bullets.push({
            x: this.x,
            y: this.y,
            // its own velocity goes into the shot, which is why the aim has to lead
            vx: Math.cos(this.angle) * AMMO_SPEED + this.vx,
            vy: Math.sin(this.angle) * AMMO_SPEED + this.vy,
            ttl: AMMO_TTL
        });
        this.fireCooldown = ENEMY_FIRE_COOLDOWN;
        if (player) player.turret_shoot();
    }

    /**
     * did the player shoot us down?
     * @param ship the player, whose bullets we're checking
     * @param player the sound system
     */
    checkPlayerBullets(ship, player) {
        for (let i = 0; i < ship.bullets.length; i++) {
            const dx = ship.bullets[i].x - this.x;
            const dy = ship.bullets[i].y - this.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.size + 4) {
                ship.bullets.splice(i, 1);
                ship.score += ENEMY_SCORE;
                this.destroy(player);
                return;
            }
        }
    }

    /**
     * the enemy's bullets travel, and can kill the player
     * @param map for wall collisions
     * @param ship the player
     * @param player the sound system
     */
    updateBullets(map, ship, player) {
        this.bullets = this.bullets.filter(b => {
            b.x += b.vx;
            b.y += b.vy;
            b.ttl--;

            // a hit on the player
            const dx = b.x - ship.x;
            const dy = b.y - ship.y;
            if (!gameOver && Math.sqrt(dx * dx + dy * dy) < ship.size) {
                triggerGameOver(player);
                return false;
            }

            // or on the cave
            if (Nav.isSolid(map.grid, Math.floor(b.x / TILE_SIZE), Math.floor(b.y / TILE_SIZE))) {
                return false;
            }
            return b.ttl > 0;
        });
    }

    /**
     * the enemy is destroyed - by the player, by a wall, or by ramming
     * @param player the sound system
     */
    destroy(player) {
        if (this.dead) return;
        this.dead = true;
        this.landed = false;
        this.path = [];
        this.createExplosion();
        if (player) player.play_explosion();
        this.respawnTimer = ENEMY_RESPAWN_DELAY;
    }

    /**
     * the enemy explodes
     */
    createExplosion() {
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 10, // Random blast direction
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03,
                color: Math.random() > 0.5 ? '#fff' : ENEMY_COLOR
            });
        }
        this.vx = 0;
        this.vy = 0;
    }

    /**
     * update the enemy's explosion particle system
     */
    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            return p.life > 0;
        });
    }

    /**
     * draw the enemy ship - the player's hull in the enemy's colour
     * @param ctx the HTML drawing context
     */
    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = ENEMY_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(-10, -8); ctx.lineTo(-10, 8); ctx.closePath();
        ctx.stroke();

        // its engine, so you can read what it's about to do
        if (this.thrusting && this.fuel > 0.0) {
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-25, 0);
            ctx.strokeStyle = ENEMY_FLAME_COLOR; ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * the enemy's bullets
     * @param ctx the HTML drawing context
     */
    drawBullets(ctx) {
        ctx.fillStyle = ENEMY_BULLET_COLOR;
        this.bullets.forEach(b => {
            ctx.fillRect(b.x - 1, b.y - 1, 3, 3);
        });
    }

    /**
     * the enemy's explosion
     * @param ctx the HTML drawing context
     */
    drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1.0;
    }

    /**
     * draw the route the planner has chosen - a development aid, off by default
     * @param ctx the HTML drawing context
     */
    drawPath(ctx) {
        if (!ENEMY_DEBUG_PATH || this.dead || this.path.length === 0) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        this.path.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
        this.path.forEach(p => ctx.fillRect(p.x - 2, p.y - 2, 4, 4));
        ctx.restore();
    }

}
