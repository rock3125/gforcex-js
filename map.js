
/**
 * the map structure and functions - deal with the world
 * drawing the world, turrets and orbs in the world
 */
class Map {

    // construct an empty map
    constructor(num_turrets, num_orbs) {
        this.grid = [];                     // two-dimensional grid that is the world
        this.turret = [];                   // turret class items
        this.num_turrets = num_turrets;     // number of turrets in the world initially
        this.orbs = [];                     // orb class items
        this.num_orbs = num_orbs;           // number of orbs in the world initially
        this.tileDamage = [];                // hits taken by each cave tile
        this.protectedTiles = new Set();     // landing pads that must survive the level
        this.terrainRevision = 0;            // lets the AI refresh its cave knowledge
        this.water_time = 0;                // water offset for shimmer effect
        this.water_bubbles = [];            // bubbles under-water
        this.terrainTextures = [            // intact to heavily fractured cave rock
            'resources/rock-tile-umber.png',
            'resources/rock-tile-umber-cracked-light.png',
            'resources/rock-tile-umber-cracked-medium.png',
            'resources/rock-tile-umber-cracked-heavy.png'
        ].map(src => this.loadTexture(src));
        this.terrainMaterials = [            // intact cave-material family
            this.terrainTextures[0],
            this.loadTexture('resources/rock-tile-umber-mineral.png'),
            this.loadTexture('resources/rock-tile-umber-mossy.png'),
            this.loadTexture('resources/rock-tile-umber-damp.png')
        ];
        this.terrainMaterial = [];           // stable material selected for each cave tile
        this.wasmTerrain = null;             // optional WebAssembly terrain implementation
        this.initBubbles();
    }

    /** Load one tile image once; the browser caches it for all later draws. */
    loadTexture(src) {
        const texture = new Image();
        texture.src = src;
        return texture;
    }

    /** Attach the WASM terrain module before the first world is generated. */
    attachWasmTerrain(terrain) {
        this.wasmTerrain = terrain;
    }


    /**
     * create a two-dimensional map
     */
    generateWorld() {
        this.turret = [];   // reset orbs and turrets
        this.orbs = [];

        if (this.wasmTerrain) {
            const seed = Math.floor(Math.random() * 0x100000000);
            const world = this.wasmTerrain.generateWorld(seed);
            this.grid = world.grid;
            this.tileDamage = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(0));
            this.terrainMaterial = world.materials;
            this.protectedTiles.clear();
            this.terrainRevision++;
            return;
        }

        // a two-dimensional array that is the world all filled in
        this.grid = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(1));
        for (let x = 1; x < GRID_RES - 1; x++) {
            for (let y = 1; y < GRID_RES - 1; y++) {
                // place random openings
                if (Math.random() > 0.42) this.grid[x][y] = 0;
            }
        }
        // replace the map with a smoothed version by expanding neighbouring empty tiles repeatedly in a + pattern
        for(let i = 0; i < 2; i++) {
            let newGrid = JSON.parse(JSON.stringify(this.grid));
            for (let x = 1; x < GRID_RES - 1; x++) {
                for (let y = 1; y < GRID_RES - 1; y++) {
                    // count how many neighbours this square has -1 to 1 in both dimensions
                    let neighbors = 0;
                    for(let i=-1; i<=1; i++)
                        for(let j=-1; j<=1; j++)
                            neighbors += this.grid[x+i][y+j];
                    // keep it solid if all neighbours were solid only
                    newGrid[x][y] = neighbors > 4 ? 1 : 0;
                }
            }
            this.grid = newGrid; // set up the new grid
        }

        // make sure different caves connect
        this.ensureConnectivity();
        this.tileDamage = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(0));
        this.terrainMaterial = this.createTerrainMaterials();
        this.protectedTiles.clear();
        this.terrainRevision++;
    }

    /**
     * Give each cave tile one stable material. Smooth coordinate noise makes broad,
     * natural patches instead of a flickering, checkerboard-like random mix.
     */
    createTerrainMaterials() {
        const materials = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(0));
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.grid[x][y] !== 1) continue;

                const top = y * TILE_SIZE;
                const cluster = this.terrainNoise(x, y, 4);
                const exposedTop = y > 0 && this.grid[x][y - 1] === 0;

                if (top >= WATER_Y) {
                    materials[x][y] = 3; // damp stone belongs in the submerged cave
                } else if (exposedTop && cluster > 0.72) {
                    materials[x][y] = 2; // moss stays sparse and grows on upper surfaces
                } else if (cluster > 0.50 && cluster < 0.68) {
                    materials[x][y] = 1; // restrained mineral patches break up broad walls
                }
            }
        }
        return materials;
    }

    /** Deterministic, smoothly blended value noise in the 0–1 range. */
    terrainNoise(x, y, scale) {
        const sampleX = x / scale;
        const sampleY = y / scale;
        const x0 = Math.floor(sampleX);
        const y0 = Math.floor(sampleY);
        const fade = value => value * value * (3 - 2 * value);
        const mix = (a, b, amount) => a + (b - a) * amount;
        const fx = fade(sampleX - x0);
        const fy = fade(sampleY - y0);
        const top = mix(this.terrainHash(x0, y0), this.terrainHash(x0 + 1, y0), fx);
        const bottom = mix(this.terrainHash(x0, y0 + 1), this.terrainHash(x0 + 1, y0 + 1), fx);
        return mix(top, bottom, fy);
    }

    /** A coordinate hash keeps material choices fixed for the lifetime of the map. */
    terrainHash(x, y) {
        const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
        return value - Math.floor(value);
    }

    /** Keep a mission-critical landing pad intact even when the player mines nearby rock. */
    protectTile(x, y) {
        this.protectedTiles.add(`${x},${y}`);
    }

    /**
     * Apply one player-shot impact. The world border is always solid, and protected
     * landing pads stay available so a mined-out cave cannot strand either ship.
     * @returns {boolean} whether the shot hit solid terrain and should disappear
     */
    damageTile(x, y) {
        if (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES || this.grid[x][y] !== 1) {
            return false;
        }

        const border = x === 0 || y === 0 || x === GRID_RES - 1 || y === GRID_RES - 1;
        if (border || this.protectedTiles.has(`${x},${y}`)) return true;

        if (this.wasmTerrain) {
            const result = this.wasmTerrain.damageTile(x, y, TILE_HITS_TO_DESTROY);
            if (result === 0) return false;
            this.tileDamage[x][y] = this.wasmTerrain.getDamage(x, y);
            if (result === 2) {
                this.grid[x][y] = 0;
                this.tileDamage[x][y] = 0;
                this.terrainRevision++;
            }
            return true;
        }

        this.tileDamage[x][y]++;
        if (this.tileDamage[x][y] >= TILE_HITS_TO_DESTROY) {
            this.grid[x][y] = 0;
            this.tileDamage[x][y] = 0;
            this.terrainRevision++;
        }
        return true;
    }

    /**
     * place map turrets relative to the player
     * @param ship the player
     */
    placeTurrets(ship) {
        // set up the turrets in the cave
        let max_tries = 5
        while (this.turret.length < this.num_turrets && max_tries > 0) {
            for (let x = 1; x < GRID_RES - 1; x++) {
                for (let y = 1; y < GRID_RES - 1; y++) {
                    // enough turrets created?
                    if (this.turret.length >= this.num_turrets) break;
                    if (this.grid[x][y] !== 0) continue;

                    // distance to player must be more than 10 squares
                    const dx = ship.home_x - x;
                    const dy = ship.home_y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    if (distance <= 10) continue;

                    // not on top of another turret
                    let existing = false;
                    for (let ti = 0; ti < this.turret.length && !existing; ti++) {
                        if (this.turret[ti].tileX === x && this.turret[ti].tileY === y) {
                            existing = true;
                        }
                    }
                    if (existing) continue;

                    // place a new left or right facing turret?
                    if (this.grid[x + 1][y] === 1 && Math.random() > 0.95) {
                        this.turret.push(new Turret(x, y, 'left'));
                    }
                    else if (this.grid[x - 1][y] === 1 && Math.random() > 0.95) {
                        this.turret.push(new Turret(x, y, 'right'));
                    }

                }
            }
            max_tries -= 1
        }
    }

    /**
     * place map orbs relative to the player after the turrets have been placed
     * @param ship the player
     */
    placeOrbs(ship) {
        // orb placement
        let max_tries = 5
        while (this.orbs.length < this.num_orbs && max_tries > 0) {
            for (let x = 1; x < GRID_RES - 1; x++) {
                for (let y = 1; y < GRID_RES - 1; y++) {

                    if (this.orbs.length >= this.num_orbs) break;

                    // distance to player must be more than 10 squares
                    const dx = ship.home_x - x;
                    const dy = ship.home_y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    if (distance <= 10) continue;

                    // place if we have empty spot, on top of something
                    if (this.grid[x][y] !== 0) continue;
                    if (this.grid[x][y + 1] === 0) continue;
                    if (Math.random() < 0.95) continue;

                    // can't be next to a turret either
                    let smallest = 1000.0
                    for (let ti = 0; ti < this.turret.length; ti++) {
                        const dx = this.turret[ti].tileX - x;
                        const dy = this.turret[ti].tileY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy)
                        if (distance < smallest) {
                            smallest = distance;
                        }
                    }
                    if (smallest < 4) continue; // too close to the closest turret?

                    // not on top of another orb
                    let existing = false;
                    for (let ti = 0; ti < this.orbs.length && !existing; ti++) {
                        if (this.orbs[ti].tileX === x && this.orbs[ti].tileY === y) {
                            existing = true;
                        }
                    }
                    if (existing) continue;

                    this.orbs.push(new Orb(x, y));
                }
            }
            max_tries -= 1
        }
    }

    /**
     * Initialize bubbles with varying speeds and depths
     */
    initBubbles() {
        for (let i = 0; i < BUBBLE_COUNT; i++) {
            this.water_bubbles.push({
                x: Math.random() * WORLD_SIZE,
                y: WATER_Y + Math.random() * (WORLD_SIZE - WATER_Y),
                speed: 0.5 + Math.random() * 1.5,
                wobbleSpeed: 0.02 + Math.random() * 0.05,
                wobbleWidth: 2 + Math.random() * 5,
                size: 1 + Math.random() * 3,
                opacity: 0.1 + Math.random() * 0.4
            });
        }
    }

    /**
     * traverse the cave system and make sure adjacent holes connect, creating an intricate
     * connected cave system
     */
    ensureConnectivity() {
        let regions = [];
        // keep track of visited locations
        let visited = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(false));
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                // an empty space not-yet visited?
                if (this.grid[x][y] === 0 && !visited[x][y]) {
                    let region = [];
                    let queue = [[x, y]]; // initialize this location
                    visited[x][y] = true;
                    while (queue.length > 0) {
                        // grab the current location to check
                        let [cx, cy] = queue.shift();
                        region.push([cx, cy]);
                        // go left, right, down, up
                        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
                            let nx = cx+dx, ny = cy+dy;
                            // inside the grid area? and an empty space, and not yet visited
                            if (nx >= 0 && nx < GRID_RES && ny >= 0 && ny < GRID_RES && this.grid[nx][ny] === 0 && !visited[nx][ny]) {
                                visited[nx][ny] = true;
                                queue.push([nx, ny]);
                            }
                        });
                    }
                    // collect this list of regions that connect empty spaces
                    regions.push(region);
                }
            }
        }

        // sort by size
        regions.sort((a, b) => b.length - a.length);
        for (let i = 1; i < regions.length; i++) {
            // clear out the connecting areas
            regions[i].forEach(([x, y]) => this.grid[x][y] = 1);
        }
    }

    /**
     * draw the player's mini map of the giant map using the mini map context
     * @param mCtx the mini map context
     * @param ship the player
     * @param enemy the AI opponent (optional)
     */
    drawMinimap(mCtx, ship, enemy) {
        mCtx.clearRect(0,0,150,150);
        const s = 150 / GRID_RES;
        for(let x=0; x<GRID_RES; x++) {
            for(let y=0; y<GRID_RES; y++) {
                if(this.grid[x][y] === 1) {
                    if (x === ship.home_x && y === ship.home_y) {
                        mCtx.fillStyle = BASE_COLOR_SMALL_MAP;
                    } else if (x === ship.end_x && y === ship.end_y) {
                        mCtx.fillStyle = NEXT_LEVEL_COLOR_SMALL_MAP;
                    } else if (enemy && x === enemy.pad_x && y === enemy.pad_y) {
                        mCtx.fillStyle = ENEMY_BASE_COLOR_SMALL_MAP;
                    } else {
                        mCtx.fillStyle = '#444';
                    }
                    mCtx.fillRect(x*s, y*s, s, s);
                }
            }
        }
        // draw the "ship" on the mini-map
        mCtx.fillStyle = 'red';
        mCtx.fillRect((ship.x/WORLD_SIZE)*150 - 2, (ship.y/WORLD_SIZE)*150 - 2, 4, 4);

        // and the enemy, so you can see it coming
        if (enemy && !enemy.dead) {
            mCtx.fillStyle = ENEMY_COLOR;
            mCtx.fillRect((enemy.x/WORLD_SIZE)*150 - 2, (enemy.y/WORLD_SIZE)*150 - 2, 4, 4);
        }
    }

    /**
     * update logic for all turrets and orbs relative to the ship
     * @param ship the player
     * @param player the sound system
     */
    update(ship, player) {
        // Turrets
        this.turret.forEach(t => {
            t.update(this, ship, player);
        });
        // Orbs
        this.orbs.forEach(orb => {
            orb.update(ship, player);
        });
        // shimmer the water
        this.water_time += 0.05
    }

    /**
     * did the user collect all orbs?
     * @return {boolean} true if there are no uncollected orbs
     */
    collected_all_orbs() {
        let not_collected = 0;
        // Orbs
        this.orbs.forEach(orb => {
            if (!orb.collected) not_collected += 1
        });
        return not_collected === 0
    }

    /**
     * draw the world relative to our ship
     * @param ctx the HTML drawing context
     * @param mCtx the HTML mini-map drawing context
     * @param ship the player
     * @param enemy the AI opponent (optional)
     */
    draw(ctx, mCtx, ship, enemy) {
        // fill black background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // camera position is the center of the screen, relative to the ship
        const camX = -ship.x + canvas.width / 2;
        const camY = -ship.y + canvas.height / 2;

        // save context
        ctx.save();
        // move the camera in our world coordinates
        ctx.translate(camX, camY);

        // draw the water (with opacity)
        // ctx.fillStyle = 'rgba(0, 50, 200, 0.2)';
        // ctx.fillRect(0, WATER_Y, WORLD_SIZE, WORLD_SIZE - WATER_Y);
        this.drawWater(ctx);

        // draw the terrain / map itself, the blocks
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.grid[x][y] === 1) { // filled in / not empty?
                    const left = x * TILE_SIZE;
                    const top = y * TILE_SIZE;
                    // Our landing pads retain their identifying colours. Every other
                    // cave block uses the same edge-to-edge rock texture, so a wall
                    // reads as continuous stone instead of a grid of flat fills.
                    if (x === ship.home_x && y === ship.home_y) {
                        ctx.fillStyle = BASE_COLOR;
                        ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
                    } else if (x === ship.end_x && y === ship.end_y) {
                        ctx.fillStyle = NEXT_LEVEL_COLOR;
                        ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
                    } else if (enemy && x === enemy.pad_x && y === enemy.pad_y) {
                        ctx.fillStyle = ENEMY_BASE_COLOR;
                        ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
                    } else {
                        const material = this.terrainMaterial[x][y];
                        this.drawTerrainTexture(ctx, this.terrainMaterials[material], left, top);
                        this.drawTileDamage(ctx, x, y);
                        // Preserve the depth cue without replacing the rock material.
                        if (top >= WATER_Y) {
                            ctx.fillStyle = 'rgba(14, 38, 64, 0.42)';
                            ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
                        }
                    }
                }
            }
        }

        // draw the ship's bullets and explosion
        ship.drawBullets(ctx);
        ship.drawParticles(ctx);

        // draw the ship if we're still in-game
        if (!gameOver) {
            ship.draw(ctx);
        }

        // draw the AI opponent, its shots and its wreckage
        if (enemy) {
            enemy.drawPath(ctx);
            enemy.drawBullets(ctx);
            enemy.drawParticles(ctx);
            enemy.draw(ctx);
        }

        // draw all turrets
        this.turret.forEach(t => {
            t.draw(ctx);
        });

        // draw all orbs
        this.orbs.forEach(orb => {
            orb.draw(ctx);
        });

        // restore drawing context
        ctx.restore();

        // draw a darkened vignette across the whole
        this.drawVignette(ctx);

        // Update Minimap Player Dot
        this.drawMinimap(mCtx, ship, enemy);

        // draw heads up display
        ship.drawFuelGauge(ctx);
        ship.drawAmmoGauge(ctx);
        ship.drawLives(ctx, LIVES_X, LIVES_Y);
        this.drawOrbs(ctx, ORBS_X, ORBS_Y);
    }

    /** Replace rock with the matching fracture texture as it absorbs damage. */
    drawTileDamage(ctx, x, y) {
        const hits = this.tileDamage[x][y];
        if (hits === 0) return;

        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const stage = Math.min(TILE_DAMAGE_STAGES,
            Math.ceil(hits / (TILE_HITS_TO_DESTROY / TILE_DAMAGE_STAGES)));
        this.drawTerrainTexture(ctx, this.terrainTextures[stage], left, top);
    }

    /** Keep terrain visible while an image is still loading on the first frame. */
    drawTerrainTexture(ctx, texture, left, top) {
        if (texture.complete && texture.naturalWidth > 0) {
            ctx.drawImage(texture, left, top, TILE_SIZE, TILE_SIZE);
            return;
        }
        ctx.fillStyle = '#5d4b3a';
        ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
    }

    /**
     * darken the screen radially inward
     * @param ctx the HTML context
     */
    drawVignette(ctx) {
        ctx.save();
        // Use 'multiply' or 'destination-in' to darken edges
        const gradient = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, canvas.height/4,
            canvas.width/2, canvas.height/2, canvas.width/1.2
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');     // Clear center
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');   // Dark edges

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    drawWater(ctx) {
        ctx.save();

        // Create a "shimmer" gradient
        const shimmerOffset = Math.sin(this.water_time * 0.5) * 50;
        const gradient = ctx.createLinearGradient(0, WATER_Y + shimmerOffset, 0, WORLD_SIZE);

        gradient.addColorStop(0, 'rgba(0, 180, 255, 0.4)'); // Surface light
        gradient.addColorStop(0.1, 'rgba(0, 80, 200, 0.3)'); // Mid depth
        gradient.addColorStop(1, 'rgba(0, 20, 50, 0.6)');    // Deep dark

        ctx.fillStyle = gradient;

        // 2. Draw the waving surface
        ctx.beginPath();
        ctx.moveTo(0, WORLD_SIZE); // Bottom left
        ctx.lineTo(0, WATER_Y);     // Start of water level

        // Draw the wavy top line
        for (let x = 0; x <= WORLD_SIZE; x += 50) {
            // Combine two sine waves for a more "organic" jagged shimmer
            const wave1 = Math.sin(x * 0.01 + this.water_time) * 5;
            const wave2 = Math.sin(x * 0.02 + this.water_time * 0.8) * 3;
            ctx.lineTo(x, WATER_Y + wave1 + wave2);
        }

        ctx.lineTo(WORLD_SIZE, WATER_Y);
        ctx.lineTo(WORLD_SIZE, WORLD_SIZE);
        ctx.closePath();
        ctx.fill();

        // 3. Add a "Surface Sparkle" line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke(); // This draws the top wavy line we just defined

        ctx.restore();

        // draw the under-water bubbles
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        this.water_bubbles.forEach(b => {
            // Move Upward (Buoyancy)
            b.y -= b.speed;

            // Sinusoidal Wobble (Side-to-side movement)
            const currentWobble = Math.sin(b.y * b.wobbleSpeed) * b.wobbleWidth;

            // Reset if they hit the surface (WATER_Y)
            if (b.y < WATER_Y) {
                b.y = WORLD_SIZE; // Send back to the bottom
                b.x = Math.random() * WORLD_SIZE; // Randomize horizontal start
            }

            // 4. Draw with a "High-Light" effect
            // Instead of a flat circle, we draw a tiny white arc to simulate a reflection
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity})`;
            ctx.lineWidth = 1;
            ctx.arc(b.x + currentWobble, b.y, b.size, 0, Math.PI * 2);
            ctx.stroke();

            // Add a tiny "glint" (the highlight on the bubble)
            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity + 0.2})`;
            ctx.arc(b.x + currentWobble - b.size/3, b.y - b.size/3, b.size/4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // draw the map's orbs
    drawOrbs(ctx, x, y) {
        ctx.save();
        ctx.translate(x, y)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // draw all orbs
        this.orbs.forEach(orb => {
            if (!orb.collected) {
                ctx.translate(16, 0);
                ctx.beginPath(); // Begin a new path
                ctx.arc(0, 0, 5, 0.0, Math.PI * 2);
                ctx.stroke();
            }
        });

        ctx.restore();
    }

}
