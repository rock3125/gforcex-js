
class Ship {

    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;

        this.angle = -Math.PI / 2;
        this.rotationSpeed = 0.04;
        this.thrust = 0.16;
        this.fuel = 0.0;
        this.ammo = 0;
        this.landed = true;
        this.size = 10;
        this.home_x = 0; // player's home block
        this.home_y = 0;
        this.bullets = [];
        this.particles = [];
    }

    land() {
        this.vx = 0.0;
        this.vy = 0.0;
        this.angle = -Math.PI / 2;
        this.landed = true;
        // reset ship height
        this.y = (this.home_y-1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
    }

    fire() {
        if (this.bullets.length < MAX_BULLETS_AT_ONCE && this.ammo > 0) {
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
    }

    reset(map) {
        this.vx = 0; this.vy = 0;
        this.angle = -Math.PI / 2;
        this.landed = true;
        this.home_x = 0; this.home_y = 0;
        // create the home 'base' block
        for(let y=5; y<GRID_RES; y++) {
            for(let x=1; x<GRID_RES; x++) {
                if(this.home_x === 0 && this.home_y === 0 &&
                    map.grid[x][y] !== 0 && map.grid[x][y-1] === 0 && map.grid[x][y-2] === 0) {
                    // set ship's location and the home block
                    this.x = x * TILE_SIZE + TILE_SIZE/2;
                    this.y = (y-1) * TILE_SIZE + (TILE_SIZE - TILE_SIZE / 10);
                    this.home_x = x;
                    this.home_y = y;
                }
            }
        }
    }

    drawBullets(camX, camY) {
        ctx.fillStyle = "yellow";
        this.bullets.forEach(b => {
            // Draw as a small 2x2 square
            ctx.fillRect(b.x, b.y, 2, 2);
        });
    }

    drawParticles() {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1.0; // Reset alpha for other drawing
    }

    drawFuelGauge() {
        // Calculate ratio (0.0 to 1.0)
        const fuelRatio = this.fuel / MAX_FUEL;
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

    drawAmmoGauge() {
        // Calculate ratio (0.0 to 1.0)
        const ammoRatio = this.ammo / MAX_AMMO;
        const greenWidth = AMMO_WIDTH * ammoRatio;
        const redWidth = AMMO_WIDTH - greenWidth;

        // Draw Fuel Remaining (Green)
        ctx.fillStyle = '#048';
        ctx.fillRect(AMMO_X, AMMO_Y, greenWidth, AMMO_HEIGHT);

        // Draw Fuel Spent (Red)
        if (this.fuel < MAX_FUEL) {
            ctx.fillStyle = '#444';
            // Start drawing where the green bar ends
            ctx.fillRect(AMMO_X + greenWidth, AMMO_Y, redWidth, AMMO_HEIGHT);
        }

        // Draw a white border around the whole thing
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(AMMO_X, AMMO_Y, AMMO_WIDTH, AMMO_HEIGHT);
    }

    updateBullets(map) {
        this.bullets = this.bullets.filter(b => {
            // Move
            b.x += b.vx;
            b.y += b.vy;
            b.ttl--;

            // Collision with Cave Walls
            const gx = Math.floor(b.x / TILE_SIZE);
            const gy = Math.floor(b.y / TILE_SIZE);
            const hitWall = map.grid[gx] && map.grid[gx][gy] === 1;

            // Keep bullet only if alive and hasn't hit a wall
            return b.ttl > 0 && !hitWall;
        });
    }

    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            return p.life > 0;
        });
    }

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

    checkKeys() {
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

    update(map) {
        this.checkKeys();

        const inWater = this.y > WATER_Y;
        this.vy += inWater ? BUOYANCY : GRAVITY;
        this.vx *= (inWater ? WATER_DRAG : AIR_DRAG);
        this.vy *= (inWater ? WATER_DRAG : AIR_DRAG);

        // landed - no speed
        if (this.landed) {
            this.vx = 0.0;
            this.vy = 0.0;
            this.angle = -Math.PI / 2;
            if (this.fuel < MAX_FUEL) {
                this.fuel += REFUEL_SPEED;
                if (this.fuel > MAX_FUEL) {
                    this.fuel = MAX_FUEL;
                }
            }
            if (this.ammo < MAX_AMMO) {
                this.ammo += REARM_SPEED;
                if (this.ammo > MAX_AMMO) {
                    this.ammo = MAX_AMMO;
                }
            }
        }

        if (!gameOver) {
            this.x += this.vx;
            this.y += this.vy;
        }

        const angle_deg = 360 + (Math.ceil(this.angle * RAD_2_DEG) % 360);

        this.updateBullets(map);
        this.updateParticles();

        // Collision or land
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);
        if (gx < 0 || gx >= GRID_RES || gy < 0 || gy >= GRID_RES || map.grid[gx][gy] === 1) {
            // land or game over?
            if (gx === this.home_x && gy === this.home_y && angle_deg > 250 && angle_deg < 290) {
                this.land();
            } else {
                triggerGameOver();
            }
        }
    }

    // draw the ship
    draw() {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(-10, -8); ctx.lineTo(-10, 8); ctx.closePath();
        ctx.stroke();
        if (keys['ArrowDown'] && ship.fuel > 0.0) {
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-25, 0);
            ctx.strokeStyle = 'orange'; ctx.stroke();
        }
        ctx.restore();
    }

}
