
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
    }

    /**
     * turret logic
     * @param map turret bullet collision detection
     * @param ship the player to look for
     */
    update(map, ship) {
        if (this.fireCooldown > 0) this.fireCooldown--;

        // Calculate distance to ship
        const dx = ship.x - this.x;
        const dy = ship.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // player out of range - don't continue
        if (dist > this.range)  {
            // out of range, point forward
            if (this.side === 'right') {
                this.angle = 0
            } else {
                this.angle = Math.PI
            }
            this.updateBullets(map, ship); // always draw any remaining bullets
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
                    if (this.angle > -1.3) // limit the turret range
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

        // Fire if cooled down and we can shoot, and the player is still alive
        if (this.fireCooldown === 0 && can_shoot && !gameOver) {
            this.fire();
            this.fireCooldown = this.cool_down; // only fire every few frames
        }

        // draw the bullets for this turret
        this.updateBullets(map, ship)
    }

    /**
     * move the bullets across the map
     * @param map the map collision detection
     * @param ship player collision detection
     */
    updateBullets(map, ship) {
        this.bullets = this.bullets.filter(b => {
            // move the bullet
            b.x += b.vx;
            b.y += b.vy;
            b.ttl--;

            // Check if turret bullet hits ship
            const dx = b.x - ship.x;
            const dy = b.y - ship.y;
            if (Math.sqrt(dx*dx + dy*dy) < ship.size) {
                triggerGameOver();
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

        this.drawBullets(ctx);
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

