
/**
 * The player logic and draw
 */
class Ship {
    // construct a new ship
    constructor() {
        this.x = 0; // location
        this.y = 0;
        this.vx = 0; // speed
        this.vy = 0;

        this.angle = -Math.PI / 2;  // ship angle
        this.rotationSpeed = 0.04;  // how fast the ship turns per key
        this.thrust = 0.16;         // ship acceleration per thrust
        this.fuel = 0.0;            // initial fuel, empty
        this.ammo = 0;              // initial ammo, empty
        this.landed = true;         // we start in a landed position
        this.size = 10;             // the size of the ship
        this.home_x = 0;            // ship start home block (not yet set)
        this.home_y = 0;
        this.bullets = [];          // player's bullets as they exist
        this.particles = [];        // player explosion animation holder
        this.lives = 3              // initial number of lives of player
        this.score = 0              // initial score of player
    }

    /**
     * the player lands
     */
    land() {
        this.vx = 0.0;              // no more speed
        this.vy = 0.0;
        this.angle = -Math.PI / 2;  // point up
        this.landed = true;         // and we've landed
        // snap the ship to be on the platform
        this.y = (this.home_y-1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
    }

    /**
     * the player shoots
     */
    fire() {
        if (this.bullets.length >= MAX_BULLETS_AT_ONCE) return; // at maximum
        if (this.ammo <= 0) return; // out of ammo

        // create a new bullet
        this.ammo -= 1;
        this.bullets.push({
            x: this.x,
            y: this.y,
            // Add ship velocity to bullet so it feels natural
            vx: Math.cos(this.angle) * AMMO_SPEED + this.vx,
            vy: Math.sin(this.angle) * AMMO_SPEED + this.vy,
            ttl: AMMO_TTL
        });
    }

    /**
     * reset the player in the map
     *
     * @param map the map to set the player into
     * @returns {boolean} true if we managed to place the player well
     */
    reset(map) {
        this.vx = 0; this.vy = 0;   // speed = 0
        this.angle = -Math.PI / 2;  // point upwards
        this.landed = true;         // we've landed
        this.home_x = 0;            // we don't have a home location yet
        this.home_y = 0;
        this.fuel = 0.0;            // we're out of fuel and ammo
        this.ammo = 0;
        this.bullets = [];          // we're not shooting
        this.particles = [];        // nor exploding

        // find a home 'base' block on the left hand side of the map
        for(let y = 5; y < GRID_RES; y++) {
            for(let x = 1; x < GRID_RES / 2; x++) {
                // already set?
                if (this.home_x !== 0 && this.home_y !== 0) break;
                // a non-empty space with two empty spaces above it?
                if (map.grid[x][y] !== 0 && map.grid[x][y-1] === 0 && map.grid[x][y-2] === 0) {
                    // set ship's location and the home block
                    this.x = x * TILE_SIZE + TILE_SIZE/2;
                    this.y = (y-1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
                    this.home_x = x;
                    this.home_y = y;
                }
            }
        }
        // successfully set? (can't be under-water!)
        return this.home_x > 0 && this.home_y > 0 && this.home_y < WATER_Y
    }

    /**
     * the bullets travel across the map
     * @param ctx the HTML drawing context
     */
    drawBullets(ctx) {
        ctx.fillStyle = "yellow";
        this.bullets.forEach(b => {
            // Draw as a small 2x2 square
            ctx.fillRect(b.x, b.y, 2, 2);
        });
    }

    /**
     * the player's explosion
     * @param ctx the HTML drawing context
     */
    drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1.0; // Reset alpha for other drawing
    }

    /**
     * draw the fuel gauge for the ship
     * @param ctx the HTML drawing context
     */
    drawFuelGauge(ctx) {
        // Calculate ratio (0.0 to 1.0)
        const fuelRatio = this.fuel / MAX_FUEL;
        // bar widths
        const greenWidth = FUEL_WIDTH * fuelRatio;
        const redWidth = FUEL_WIDTH - greenWidth;

        // Draw Fuel Remaining (Green)
        ctx.fillStyle = '#080';
        ctx.fillRect(FUEL_X, FUEL_Y, greenWidth, FUEL_HEIGHT);

        // Draw Fuel Spent (Red)
        if (this.fuel < MAX_FUEL) {
            ctx.fillStyle = '#c00';
            // Start drawing where the green bar ends
            ctx.fillRect(FUEL_X + greenWidth, FUEL_Y, redWidth, FUEL_HEIGHT);
        }

        // Draw a white border around the whole thing
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(FUEL_X, FUEL_Y, FUEL_WIDTH, FUEL_HEIGHT);
    }

    /**
     * draw the ammon gauge
     * @param ctx the HTML drawing context
     */
    drawAmmoGauge(ctx) {
        // Calculate ratio (0.0 to 1.0)
        const ammoRatio = this.ammo / MAX_AMMO;
        // ammo bar widths
        const blueWidth = AMMO_WIDTH * ammoRatio;
        const greyWidth = AMMO_WIDTH - blueWidth;

        // Draw Ammo Remaining (Blue)
        ctx.fillStyle = '#048';
        ctx.fillRect(AMMO_X, AMMO_Y, blueWidth, AMMO_HEIGHT);

        // Draw Ammo Spent (Grey)
        if (this.fuel < MAX_FUEL) {
            ctx.fillStyle = '#444';
            // Start drawing where the green bar ends
            ctx.fillRect(AMMO_X + blueWidth, AMMO_Y, greyWidth, AMMO_HEIGHT);
        }

        // Draw a white border around the whole thing
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(AMMO_X, AMMO_Y, AMMO_WIDTH, AMMO_HEIGHT);
    }

    /**
     * bullet logic
     * @param map the player's map
     */
    updateBullets(map) {
        this.bullets = this.bullets.filter(b => {
            // Move a bullet
            b.x += b.vx;
            b.y += b.vy;
            b.ttl--; // time to live

            // Collision with cave walls?
            const gx = Math.floor(b.x / TILE_SIZE);
            const gy = Math.floor(b.y / TILE_SIZE);
            const hitWall = map.grid[gx] && map.grid[gx][gy] === 1;

            // Keep bullet only if alive and hasn't hit a wall
            return b.ttl > 0 && !hitWall;
        });
    }

    /**
     * player scores for collecting an orb
     */
    collectOrb() {
        this.score += 500
    }

    /**
     * update payer's explosion particle system
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
     * the player explodes
     */
    createExplosion() {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 10, // Random blast direction
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,      // Opacity/Life starts at 100%
                decay: 0.02 + Math.random() * 0.03,
                color: Math.random() > 0.5 ? '#fff' : '#f80' // White and Orange sparks
            });
        }
        this.vx = 0;
        this.vy = 0;
    }

    /**
     * read player keyboard and act
     */
    checkKeys(keys) {
        if (keys['ArrowLeft'] && this.fuel > 0.0) {
            this.angle -= this.rotationSpeed;
            this.fuel -= FUEL_CONSUMPTION;
        }
        if (keys['ArrowRight'] && this.fuel > 0.0) {
            this.angle += this.rotationSpeed;
            this.fuel -= FUEL_CONSUMPTION;
        }
        if (keys['ArrowDown'] && this.fuel > 0.0) {
            this.vx += Math.cos(this.angle) * this.thrust;
            if (this.landed) {
                this.landed = false;
                this.vy = -1.0; // take-off boost

                // start the soundtrack the first time we take-off
                play_title_track();

            } else {
                this.vy += Math.sin(this.angle) * this.thrust;
            }
            this.fuel -= FUEL_CONSUMPTION;
        }
        if (keys['Space'] && !gameOver) {
            this.fire();
        }
    }

    /**
     * player update logic
     * @param map the map the player finds themselves in
     * @param keys the keys controlling the player
     */
    update(map, keys) {

        this.checkKeys(keys);

        const inWater = this.y > WATER_Y;
        this.vy += inWater ? BUOYANCY : GRAVITY;
        this.vx *= (inWater ? WATER_DRAG : AIR_DRAG);
        this.vy *= (inWater ? WATER_DRAG : AIR_DRAG);

        // landed - no speed
        if (this.landed) {
            this.vx = 0.0; // speed off
            this.vy = 0.0;
            this.angle = -Math.PI / 2; // point up
            if (this.fuel < MAX_FUEL) { // start refueling if needed
                this.fuel += REFUEL_SPEED;
                if (this.fuel > MAX_FUEL) {
                    this.fuel = MAX_FUEL;
                }
            }
            if (this.ammo < MAX_AMMO) { // reload ammo if needed
                this.ammo += REARM_SPEED;
                if (this.ammo > MAX_AMMO) {
                    this.ammo = MAX_AMMO;
                }
            }
        }

        // not landed, out of fuel - count-down to self-destruct
        if (!this.landed && this.fuel <= 0.0) {
            setTimeout(() => {
                // still not landed after the timeout?
                if (!this.landed && this.fuel <= 0.0) {
                    triggerGameOver()
                }
            }, 1500);
        }

        // only move the camera if we're still alive
        if (!gameOver) {
            this.x += this.vx;
            this.y += this.vy;
        }

        this.updateBullets(map);
        this.updateParticles();

        // landing angle
        const angle_deg = 360 + (Math.ceil(this.angle * RAD_2_DEG) % 360);

        // collision or land
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);
        if (gx < 0 || gx >= GRID_RES || gy < 0 || gy >= GRID_RES || map.grid[gx][gy] === 1) {
            // land or game over?
            if (gx === this.home_x && gy === this.home_y && angle_deg > 250 && angle_deg < 290) {
                this.land();
            } else {
                triggerGameOver(); // crash!
            }
        }
    }

    /**
     * draw the ship
     * @param ctx the HTML drawing context
     */
    draw(ctx) {
        if (this.lives <= 0) return

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(-10, -8); ctx.lineTo(-10, 8); ctx.closePath();
        ctx.stroke();

        // draw the engine's output / jet
        if (keys['ArrowDown'] && this.fuel > 0.0) {
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-25, 0);
            ctx.strokeStyle = 'orange'; ctx.stroke();
        }
        ctx.restore();
    }


    // draw the ship's lives
    drawLives(x, y) {
        if (this.lives <= 0) return

        ctx.save();
        ctx.translate(x, y)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let i = 0; i < this.lives; i++) {
            ctx.translate(16, 0);
            ctx.save();
            ctx.rotate(Math.PI * 1.5)
            ctx.beginPath();
            ctx.moveTo(6, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4);
            ctx.closePath();
            ctx.restore();
            ctx.stroke();
        }
        ctx.restore();
    }

}
