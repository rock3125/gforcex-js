
class Orb {
    constructor(tileX, tileY) {
        this.x = tileX * TILE_SIZE + TILE_SIZE / 2;
        this.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        this.baseY = this.y;
        this.angle = Math.random() * Math.PI * 2; // Random start phase
        this.collected = false;
        this.size = 12;
    }

    update(ship) {
        // Floating animation
        this.angle += 0.05;
        this.y = this.baseY + Math.sin(this.angle) * 10;

        // Collision check with ship
        const dx = this.x - ship.x;
        const dy = this.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.size + ship.size) {
            this.collect();
        }
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        // Trigger bonus logic here (e.g., fuel += 20 or score += 100)
        // createExplosion(this.x, this.y, '#0ff'); // Cyan sparkles
        collectOrb();
    }

    draw() {
        if (this.collected) return

        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. Outer Pulse Glow
        const pulse = Math.sin(this.angle * 2) * 5;
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, this.size + 15 + pulse);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.arc(0, 0, this.size + 15 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // 2. The Core
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(0, 0, this.size - 4, 0, Math.PI * 2);
        ctx.fill();

        // 3. Floating "Orbitals" (Mysterious rings)
        ctx.rotate(this.angle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size, -this.size, this.size * 2, this.size * 2);

        ctx.restore();
    }

}
