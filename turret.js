
class Turret {
    constructor(tileX, tileY, side) {
        this.x = tileX * TILE_SIZE + TILE_SIZE / 2;
        this.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        this.side = side; // 'left' or 'right'
        this.angle = (side === 'left') ? Math.PI : 0;
        this.fireCooldown = 0;
        this.range = 600;
    }

    update() {
        if (this.fireCooldown > 0) this.fireCooldown--;

        // Calculate distance to ship
        const dx = ship.x - this.x;
        const dy = ship.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.range) {
            // Point towards player
            const targetAngle = Math.atan2(dy, dx);

            // Basic tracking logic (smoothing the rotation)
            this.angle = targetAngle;

            // Fire if cooled down
            if (this.fireCooldown === 0) {
                this.fire();
                this.fireCooldown = 120; // 2 seconds at 60fps
            }
        }
    }

    fire() {
        const speed = 5;
        // Re-use your existing bullet logic/array
        bullets.push({
            x: this.x + Math.cos(this.angle) * 20,
            y: this.y + Math.sin(this.angle) * 20,
            vx: Math.cos(this.angle) * speed,
            vy: Math.sin(this.angle) * speed,
            ttl: 200,
            owner: 'turret' // Tag it so it doesn't kill the turret
        });
    }

    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x + camX, this.y + camY);

        // Draw the Base (Triangle)
        ctx.rotate((this.side === 'left') ? 0 : Math.PI);
        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.moveTo(10, -15);
        ctx.lineTo(10, 15);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();

        // Draw the Barrel (Rotates)
        ctx.restore();
        ctx.save();
        ctx.translate(this.x + camX, this.y + camY);
        ctx.rotate(this.angle);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        ctx.restore();
    }
}
