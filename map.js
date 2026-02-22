
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
    }


    /**
     * create a two-dimensional map
     */
    generateWorld() {
        this.turret = [];   // reset orbs and turrets
        this.orbs = [];

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
                        if (this.turret[ti].x === x && this.turret[ti].y === y) {
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
                        const dx = this.turret[ti].x - x;
                        const dy = this.turret[ti].y - y;
                        const distance = Math.sqrt(dx * dx + dy * dy)
                        if (distance < smallest) {
                            smallest = distance;
                        }
                    }
                    if (smallest < 4) continue; // too close to the closest turret?

                    // not on top of another orb
                    let existing = false;
                    for (let ti = 0; ti < this.orbs.length && !existing; ti++) {
                        if (this.orbs[ti].x === x && this.orbs[ti].y === y) {
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
     * @param mCtx the mini mao context
     * @param ship the player
     */
    drawMinimap(mCtx, ship) {
        mCtx.clearRect(0,0,150,150);
        const s = 150 / GRID_RES;
        for(let x=0; x<GRID_RES; x++) {
            for(let y=0; y<GRID_RES; y++) {
                if(this.grid[x][y] === 1) {
                    if (x === ship.home_x && y === ship.home_y) {
                        mCtx.fillStyle = BASE_COLOR_SMALL_MAP;
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
    }

    /**
     * update logic for all turrets and orbs relative to the ship
     * @param ship the player
     */
    update(ship) {
        // Turrets
        this.turret.forEach(t => {
            t.update(this, ship);
        });
        // Orbs
        this.orbs.forEach(orb => {
            orb.update(ship);
        });
    }

    /**
     * draw the world relative to our ship
     * @param ctx the HTML drawing context
     * @param mCtx the HTML mini-map drawing context
     * @param ship the player
     */
    draw(ctx, mCtx, ship) {
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
        ctx.fillStyle = 'rgba(0, 50, 200, 0.2)';
        ctx.fillRect(0, WATER_Y, WORLD_SIZE, WORLD_SIZE - WATER_Y);

        // draw the terrain / map itself, the blocks
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.grid[x][y] === 1) { // filled in / not empty?
                    // our base has a different colour from all the other blocks
                    if (x === ship.home_x && y === ship.home_y) {
                        ctx.fillStyle = BASE_COLOR;
                    } else {
                        // blocks under water have a different colour from above the water-line
                        ctx.fillStyle = (y * TILE_SIZE >= WATER_Y) ? '#1a2a3a' : '#332211';
                    }
                    // create the block
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    // with a border
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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

        // draw all turrets
        this.turret.forEach(t => {
            t.draw();
        });

        // draw all orbs
        this.orbs.forEach(orb => {
            orb.draw(ctx);
        });

        // restore drawing context
        ctx.restore();

        // Update Minimap Player Dot
        this.drawMinimap(mCtx, ship);

        // draw heads up display
        ship.drawFuelGauge(ctx);
        ship.drawAmmoGauge(ctx);
        ship.drawLives(LIVES_X, LIVES_Y);
    }

}

