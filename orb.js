
/**
 * a mysterious Orb object to collect
 */
class Orb {
    // create an orb at (x,y)
    constructor(tileX, tileY) {
        this.x = tileX * TILE_SIZE + TILE_SIZE / 2;
        this.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        this.baseY = this.y;
        this.angle = Math.random() * Math.PI * 2; // random start phase
        this.collected = false; // collected by player?
        this.size = 12; // size of the object
    }

    /**
     * perform orb logic
     * @param ship the player (distance for collect)
     */
    update(ship) {
        // floating animation
        this.angle += 0.05;
        this.y = this.baseY + Math.sin(this.angle) * 10;

        // Collision check with ship
        const dx = this.x - ship.x;
        const dy = this.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // do we collect this orb?  get the point?
        if (dist < this.size + ship.size) {
            this.collect(ship);
        }
    }

    /**
     * the player collects an orb
     * @param ship the player
     */
    collect(ship) {
        if (this.collected) return; // already collected, don't process again
        this.collected = true;
        ship.collectOrb();
    }

    /**
     * draw the orb
     * @param ctx the drawing context
     */
    draw(ctx) {
        if (this.collected) return // already connected - don't draw it

        ctx.save();
        ctx.translate(this.x, this.y);

        // draw the outer Pulse Glow
        const pulse = Math.sin(this.angle * 2) * 5;
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, this.size + 15 + pulse);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.arc(0, 0, this.size + 15 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // draw the core
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(0, 0, this.size - 4, 0, Math.PI * 2);
        ctx.fill();

        // draw the floating "Orbitals" (Mysterious rings)
        ctx.rotate(this.angle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size, -this.size, this.size * 2, this.size * 2);

        ctx.restore();
    }

}
