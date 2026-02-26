
/**
 * a turret on the map, trying to take down the player
 */
class Turret {

    constructor(tileX, tileY, side) {
        // set the correct offset of the turret depending on where it lives
        if (side === 'left') {
            this.x = tileX * TILE_SIZE + (TILE_SIZE - (TILE_SIZE / 10));
        } else {
            this.x = tileX * TILE_SIZE + (TILE_SIZE / 10);
        }
        this.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        this.side = side; // 'left' or 'right'
        this.angle = (side === 'left') ? Math.PI : 0; // angle of the barrel
        this.fireCooldown = 0;      // can't fire constantly
        this.range = 600;           // sensitive to player distance to turret
        this.speed = 5;             // bullet speed
        this.cool_down = 10;        // how many frame before can fire again
        this.bullets = [];          // the turret's bullets
        this.particles = [];        // turret explosion animation holder
        this.destroyed = false;
        this.tileX = tileX;         // keep track of its tile position
        this.tileY = tileY;
    }

    /**
     * turret logic
     * @param map turret bullet collision detection
     * @param ship the player to look for
     * @param player the sound player
     */
    update(map, ship, player) {
        if (this.fireCooldown > 0) this.fireCooldown--;

        // update any particles
        this.updateParticles();
        this.updateBullets(map, ship, player);

        // does the ship hit the turret with its weapons?
        if (!this.destroyed) {
            for (let i = 0; i < ship.bullets.length; i++) {
                const dx = ship.bullets[i].x - this.x;
                const dy = ship.bullets[i].y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 12) { // within range?
                    this.createExplosion();
                    player.play_explosion();
                }
            }

            // Calculate distance to ship
            const dx = ship.x - this.x;
            const dy = ship.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // player out of range - don't continue
            if (dist > this.range) {
                // out of range, point forward
                if (this.side === 'right') {
                    this.angle = 0
                } else {
                    this.angle = Math.PI
                }
                return;
            }

            // Point towards player, basic tracking logic
            this.angle = Math.atan2(dy, dx);

            // limit the angles depending the location
            let can_shoot = false; // can we fire?
            if (this.side === 'right') {
                // as long as the ship is on the correct side of this turret
                if (ship.x > this.x) {
                    if (this.angle < -0.8) // angle limit 1
                        this.angle = -0.8
                    else
                        can_shoot = true

                    if (this.angle > 0.8) // angle limit 2
                        this.angle = 0.8
                    else
                        can_shoot = true

                } else {
                    // otherwise - just point forward, and don't shoot (the player is on the wrong side of the turret)
                    this.angle = 0
                }

            } else {

                // the ship is on the correct side of this turret
                if (ship.x < this.x) {
                    // ship above the turret
                    if (this.y > ship.y) {
                        if (this.angle > -1.3) // limit the turret range in radians
                            this.angle = -1.3
                        else
                            can_shoot = true

                    } else {
                        if (this.angle < 1.3)
                            this.angle = 1.3
                        else
                            can_shoot = true
                    }

                } else {
                    // just point forward (the player is on the wrong side of the turret)
                    this.angle = Math.PI;
                }

            }

            // Fire if cooled down, and we can shoot, and the player is still alive
            if (this.fireCooldown === 0 && can_shoot && !gameOver && !this.destroyed) {
                this.fire();
                player.turret_shoot();
                this.fireCooldown = this.cool_down; // only fire every few frames
            }

        } // if ! destroyed

    }

    /**
     * the turret explodes
     */
    createExplosion() {
        this.destroyed = true;
        for (let i = 0; i < 25; i++) {
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
    }

    /**
     * move the bullets across the map
     * @param map the map collision detection
     * @param ship player collision detection
     * @param player the player of sounds
     */
    updateBullets(map, ship, player) {
        this.bullets = this.bullets.filter(b => {
            // move the bullet
            b.x += b.vx;
            b.y += b.vy;
            b.ttl--;

            // Check if turret bullet hits ship
            const dx = b.x - ship.x;
            const dy = b.y - ship.y;
            if (Math.sqrt(dx*dx + dy*dy) < ship.size) {
                triggerGameOver(player);
                return false;
            }

            // Standard wall collision
            const gx = Math.floor(b.x / TILE_SIZE);
            const gy = Math.floor(b.y / TILE_SIZE);
            if (map.grid[gx] && map.grid[gx][gy] === 1) return false;

            return b.ttl > 0; // true if still alive
        });
    }

    /**
     * update turret's explosion particle system
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
     * a turret decides to shoot
     */
    fire() {
        // add to the bullets
        this.bullets.push({
            x: this.x + Math.cos(this.angle) * 20,
            y: this.y + Math.sin(this.angle) * 20,
            vx: Math.cos(this.angle) * this.speed,
            vy: Math.sin(this.angle) * this.speed,
            ttl: 200
        });
    }

    /**
     * draw the turret and its bullets
     * @param ctx the HTML context
     */
    draw(ctx) {
        this.drawBullets(ctx);
        this.drawParticles(ctx);

        if (this.destroyed) return;

        // Draw the turret barrel first
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        ctx.restore();

        // draw the triangle base
        ctx.save();
        ctx.translate(this.x, this.y);
        // draw the base
        ctx.rotate((this.side === 'left') ? 0 : Math.PI);
        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.moveTo(10, -15);
        ctx.lineTo(10, 15);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * the turret's explosion
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
     * draw the turret's bullets
     * @param ctx the HTML context
     */
    drawBullets(ctx) {
        this.bullets.forEach(b => {
            ctx.save();
            ctx.translate(b.x, b.y);

            ctx.beginPath();
            ctx.fillStyle = '#00ffff';

            // Draw as a small circle or glowing square
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            // Optional: Add a small glow effect
            ctx.shadowBlur = 5;
            ctx.shadowColor = ctx.fillStyle;

            ctx.restore();
        });
    }

}

