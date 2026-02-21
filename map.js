

class Map {

    constructor() {
        this.grid = [];
    }

    generateWorld() {
        // 1. Noise
        this.grid = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(1));
        for (let x = 1; x < GRID_RES - 1; x++) {
            for (let y = 1; y < GRID_RES - 1; y++) {
                if (Math.random() > 0.42) this.grid[x][y] = 0;
            }
        }
        // 2. Smooth
        for(let i=0; i<2; i++) {
            let newGrid = JSON.parse(JSON.stringify(this.grid));
            for (let x = 1; x < GRID_RES - 1; x++) {
                for (let y = 1; y < GRID_RES - 1; y++) {
                    let neighbors = 0;
                    for(let i=-1; i<=1; i++) for(let j=-1; j<=1; j++) neighbors += this.grid[x+i][y+j];
                    newGrid[x][y] = neighbors > 4 ? 1 : 0;
                }
            }
            this.grid = newGrid;
        }
        this.ensureConnectivity();
    }

    ensureConnectivity() {
        let regions = [];
        let visited = Array.from({ length: GRID_RES }, () => Array(GRID_RES).fill(false));
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.grid[x][y] === 0 && !visited[x][y]) {
                    let region = [];
                    let queue = [[x, y]];
                    visited[x][y] = true;
                    while (queue.length > 0) {
                        let [cx, cy] = queue.shift();
                        region.push([cx, cy]);
                        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
                            let nx = cx+dx, ny = cy+dy;
                            if(nx >= 0 && nx < GRID_RES && ny >= 0 && ny < GRID_RES && this.grid[nx][ny] === 0 && !visited[nx][ny]) {
                                visited[nx][ny] = true;
                                queue.push([nx, ny]);
                            }
                        });
                    }
                    regions.push(region);
                }
            }
        }
        regions.sort((a, b) => b.length - a.length);
        for (let i = 1; i < regions.length; i++) {
            regions[i].forEach(([x, y]) => this.grid[x][y] = 1);
        }
    }

    drawMinimap() {
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
    }


    draw(ship) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const camX = -ship.x + canvas.width / 2;
        const camY = -ship.y + canvas.height / 2;

        ctx.save();
        ctx.translate(camX, camY);

        // Water
        ctx.fillStyle = 'rgba(0, 50, 200, 0.2)';
        ctx.fillRect(0, WATER_Y, WORLD_SIZE, WORLD_SIZE - WATER_Y);

        // Grid Terrain
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.grid[x][y] === 1) {
                    if (x === ship.home_x && y === ship.home_y) {
                        ctx.fillStyle = BASE_COLOR;
                    } else {
                        ctx.fillStyle = (y * TILE_SIZE >= WATER_Y) ? '#1a2a3a' : '#332211';
                    }
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        ship.drawBullets();
        ship.drawParticles();

        // Ship
        if (!gameOver) {
            ship.draw();
        }

        // Update Minimap Player Dot
        this.drawMinimap();
        ship.drawFuelGauge();
        ship.drawAmmoGauge();

        ctx.restore();

        // draw the "ship" on the mini-map
        mCtx.fillStyle = 'red';
        mCtx.fillRect((ship.x/WORLD_SIZE)*150 - 2, (ship.y/WORLD_SIZE)*150 - 2, 4, 4);
    }

}

