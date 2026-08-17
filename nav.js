
/**
 * a tiny binary min-heap, the open list for the A* search below
 */
class MinHeap {

    constructor() {
        this.items = []; // the heap itself, items are {x, y, f}
    }

    // how many items are waiting
    get size() {
        return this.items.length;
    }

    /**
     * add an item and float it up to its place
     * @param item an object with an 'f' cost field
     */
    push(item) {
        this.items.push(item);
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[parent].f <= this.items[i].f) break;
            const swap = this.items[parent];
            this.items[parent] = this.items[i];
            this.items[i] = swap;
            i = parent;
        }
    }

    /**
     * take the cheapest item and sink the last one back down
     * @returns the item with the lowest 'f'
     */
    pop() {
        const top = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;
                if (left < this.items.length && this.items[left].f < this.items[smallest].f) smallest = left;
                if (right < this.items.length && this.items[right].f < this.items[smallest].f) smallest = right;
                if (smallest === i) break;
                const swap = this.items[smallest];
                this.items[smallest] = this.items[i];
                this.items[i] = swap;
                i = smallest;
            }
        }
        return top;
    }

}


/**
 * the cave knowledge used by the AI opponent - everything it can work out about the
 * map before it decides where to fly.  Three pieces of maths live here:
 *
 *   1. a clearance field - how much elbow room every tile has, a distance transform
 *   2. line of sight    - can a bullet (or a ship) get from A to B without hitting rock
 *   3. A*               - the cheapest route through the cave, biased towards open space
 *
 * None of this knows anything about ships; it is pure geometry over the map grid.
 */
class Nav {

    constructor() {
        this.clearance = []; // clearance[x][y] = tiles between here and the nearest rock
    }

    /**
     * is this tile rock (or outside the world, which amounts to the same thing)?
     * @param grid the map grid
     * @param x tile x
     * @param y tile y
     * @returns {boolean} true if nothing can fly through here
     */
    static isSolid(grid, x, y) {
        if (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) return true;
        return grid[x][y] === 1;
    }

    /**
     * the octile distance - the exact cost of an unobstructed 8-way walk, which makes
     * it an admissible (never over-estimating) heuristic for the A* below
     * @returns {number} estimated tiles of travel
     */
    static octile(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    }

    /**
     * shortest signed angle from a to b, wrapped into (-PI, PI] so a controller
     * always turns the short way round
     * @param a the angle to turn from
     * @param b the angle to turn to
     * @returns {number} the difference in radians
     */
    static angleDiff(a, b) {
        return ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    }

    /**
     * build the clearance field for a map: a Chebyshev distance transform giving every
     * empty tile its distance to the nearest solid one.  Two sweeps over the grid is
     * all it takes - a forward pass that can only see the neighbours already visited,
     * and a backward pass that catches the rest.  Done once per level.
     *
     * @param grid the map grid
     */
    computeClearance(grid) {
        const big = GRID_RES * 2; // stands in for "infinitely far from any rock"
        this.clearance = Array.from({ length: GRID_RES }, () => new Array(GRID_RES).fill(big));

        // seed: rock is distance zero from rock
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (grid[x][y] === 1) this.clearance[x][y] = 0;
            }
        }

        // forward sweep - the causal half of the 8-neighbourhood for an x-major scan
        for (let x = 0; x < GRID_RES; x++) {
            for (let y = 0; y < GRID_RES; y++) {
                if (this.clearance[x][y] === 0) continue;
                let best = this.clearance[x][y];
                best = Math.min(best, this.readClearance(x - 1, y - 1) + 1);
                best = Math.min(best, this.readClearance(x - 1, y) + 1);
                best = Math.min(best, this.readClearance(x - 1, y + 1) + 1);
                best = Math.min(best, this.readClearance(x, y - 1) + 1);
                this.clearance[x][y] = best;
            }
        }

        // backward sweep - the other half, so every tile has seen all eight neighbours
        for (let x = GRID_RES - 1; x >= 0; x--) {
            for (let y = GRID_RES - 1; y >= 0; y--) {
                if (this.clearance[x][y] === 0) continue;
                let best = this.clearance[x][y];
                best = Math.min(best, this.readClearance(x + 1, y + 1) + 1);
                best = Math.min(best, this.readClearance(x + 1, y) + 1);
                best = Math.min(best, this.readClearance(x + 1, y - 1) + 1);
                best = Math.min(best, this.readClearance(x, y + 1) + 1);
                this.clearance[x][y] = best;
            }
        }
    }

    /**
     * raw clearance lookup - everything outside the world counts as rock
     * @param x tile x
     * @param y tile y
     * @returns {number} tiles to the nearest rock, 0 for rock itself
     */
    readClearance(x, y) {
        if (x < 0 || y < 0 || x >= GRID_RES || y >= GRID_RES) return 0;
        return this.clearance[x][y];
    }

    /**
     * clearance for use as a divisor - never zero, so callers can weigh by 1/clearance
     * @param x tile x
     * @param y tile y
     * @returns {number} at least 1
     */
    clearanceAt(x, y) {
        return Math.max(1, this.readClearance(x, y));
    }

    /**
     * can we see from one point in the world to another without rock in between?
     *
     * This walks the grid one tile boundary at a time (an Amanatides & Woo style voxel
     * traversal) rather than sampling points along the line, so it can never step over
     * a thin wall.  tMaxX/tMaxY hold how far along the ray - as a fraction of its total
     * length - the next vertical/horizontal boundary crossing lies.
     *
     * @param grid the map grid
     * @param x0 start x in world coordinates
     * @param y0 start y in world coordinates
     * @param x1 end x in world coordinates
     * @param y1 end y in world coordinates
     * @returns {boolean} true if the line is clear
     */
    rayClear(grid, x0, y0, x1, y1) {
        let gx = Math.floor(x0 / TILE_SIZE);
        let gy = Math.floor(y0 / TILE_SIZE);
        if (Nav.isSolid(grid, gx, gy)) return false; // we're inside rock already

        const gx1 = Math.floor(x1 / TILE_SIZE);
        const gy1 = Math.floor(y1 / TILE_SIZE);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const stepX = dx >= 0 ? 1 : -1;
        const stepY = dy >= 0 ? 1 : -1;

        // how much of the ray a whole tile eats up in each axis
        const tDeltaX = (dx !== 0) ? Math.abs(TILE_SIZE / dx) : Infinity;
        const tDeltaY = (dy !== 0) ? Math.abs(TILE_SIZE / dy) : Infinity;
        // ...and how much of it we spend reaching the very first boundary
        let tMaxX = (dx !== 0) ? ((dx > 0 ? (gx + 1) * TILE_SIZE - x0 : x0 - gx * TILE_SIZE) / Math.abs(dx)) : Infinity;
        let tMaxY = (dy !== 0) ? ((dy > 0 ? (gy + 1) * TILE_SIZE - y0 : y0 - gy * TILE_SIZE) / Math.abs(dy)) : Infinity;

        let guard = GRID_RES * 4; // the grid is finite, so this loop must be too
        while (guard-- > 0) {
            if (gx === gx1 && gy === gy1) return true;  // arrived
            if (tMaxX > 1 && tMaxY > 1) return true;    // ran off the end of the segment
            // cross whichever boundary comes first
            if (tMaxX < tMaxY) {
                gx += stepX;
                tMaxX += tDeltaX;
            } else {
                gy += stepY;
                tMaxY += tDeltaY;
            }
            if (Nav.isSolid(grid, gx, gy)) return false;
        }
        return true;
    }

    /**
     * line of sight for something with a body - three parallel rays down the middle and
     * along either shoulder, so a ship doesn't try to thread a gap narrower than itself
     *
     * @param grid the map grid
     * @param x0 start x in world coordinates
     * @param y0 start y in world coordinates
     * @param x1 end x in world coordinates
     * @param y1 end y in world coordinates
     * @param radius half-width to keep clear
     * @returns {boolean} true if a body of that width fits down the line
     */
    corridorClear(grid, x0, y0, x1, y1, radius) {
        if (!this.rayClear(grid, x0, y0, x1, y1)) return false;
        if (radius <= 0) return true;

        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-6) return true;

        // the normal to the line, scaled out to the body's half-width
        const nx = -dy / len * radius;
        const ny = dx / len * radius;
        return this.rayClear(grid, x0 + nx, y0 + ny, x1 + nx, y1 + ny) &&
               this.rayClear(grid, x0 - nx, y0 - ny, x1 - nx, y1 - ny);
    }

    /**
     * find a flyable tile at or near the one asked for - used when a target lands
     * inside rock (the player can be mid-crash, for instance)
     *
     * @param grid the map grid
     * @param x tile x
     * @param y tile y
     * @param maxRadius how many rings out to look
     * @returns {{x: number, y: number}|null} an empty tile, or null if there isn't one
     */
    nearestOpen(grid, x, y, maxRadius) {
        if (!Nav.isSolid(grid, x, y)) return { x: x, y: y };
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // only the outside of the ring - the inside was covered by earlier passes
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (!Nav.isSolid(grid, x + dx, y + dy)) return { x: x + dx, y: y + dy };
                }
            }
        }
        return null;
    }

    /**
     * A* across the tile grid, 8-connected.
     *
     * The twist is in the step cost: moving into a tile is charged extra in proportion
     * to 1/clearance, so a route that scrapes along a wall costs more than one down the
     * middle of a cavern.  That single term is the difference between an opponent that
     * looks like it knows the cave and one that grinds its hull along the rock.
     *
     * @param grid the map grid
     * @param sx start tile x
     * @param sy start tile y
     * @param tx target tile x
     * @param ty target tile y
     * @returns {Array|null} the tile path including the start tile, or null if unreachable
     */
    findPath(grid, sx, sy, tx, ty) {
        if (Nav.isSolid(grid, sx, sy) || Nav.isSolid(grid, tx, ty)) return null;

        const index = (x, y) => x * GRID_RES + y;
        const cost = new Float64Array(GRID_RES * GRID_RES).fill(Infinity);
        const cameFrom = new Int32Array(GRID_RES * GRID_RES).fill(-1);
        const closed = new Uint8Array(GRID_RES * GRID_RES);
        const open = new MinHeap();

        cost[index(sx, sy)] = 0;
        open.push({ x: sx, y: sy, f: Nav.octile(sx, sy, tx, ty) });

        let guard = GRID_RES * GRID_RES * 8; // a hard stop, the grid can't need more
        while (open.size > 0 && guard-- > 0) {
            const current = open.pop();
            const ci = index(current.x, current.y);
            if (closed[ci]) continue; // a cheaper copy of this node was already handled
            closed[ci] = 1;

            // arrived - walk the parent links back to the start
            if (current.x === tx && current.y === ty) {
                const path = [];
                let i = ci;
                while (i !== -1) {
                    path.push({ x: Math.floor(i / GRID_RES), y: i % GRID_RES });
                    i = cameFrom[i];
                }
                return path.reverse();
            }

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = current.x + dx;
                    const ny = current.y + dy;
                    if (Nav.isSolid(grid, nx, ny)) continue;
                    // a diagonal needs both of its orthogonal neighbours open, otherwise
                    // the route would clip the corner of a block
                    if (dx !== 0 && dy !== 0 &&
                        (Nav.isSolid(grid, current.x + dx, current.y) ||
                         Nav.isSolid(grid, current.x, current.y + dy))) continue;

                    const ni = index(nx, ny);
                    if (closed[ni]) continue;

                    const step = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
                    // pay a toll for flying close to rock
                    const stepCost = step * (1 + ENEMY_CLEARANCE_WEIGHT / this.clearanceAt(nx, ny));
                    const g = cost[ci] + stepCost;
                    if (g < cost[ni]) {
                        cost[ni] = g;
                        cameFrom[ni] = ci;
                        open.push({ x: nx, y: ny, f: g + Nav.octile(nx, ny, tx, ty) });
                    }
                }
            }
        }
        return null; // no route
    }

    /**
     * pull the string taut.  A grid path is a staircase; most of its corners are
     * pointless because the ship can fly straight past them.  Walk the path and keep
     * only the waypoints that actually turn the corner.
     *
     * @param grid the map grid
     * @param tiles the tile path from findPath
     * @param fromX where the ship actually is, world x
     * @param fromY where the ship actually is, world y
     * @param radius the ship's half-width
     * @returns {Array} waypoints in world coordinates
     */
    smoothPath(grid, tiles, fromX, fromY, radius) {
        const points = tiles.map(t => ({
            x: t.x * TILE_SIZE + TILE_SIZE / 2,
            y: t.y * TILE_SIZE + TILE_SIZE / 2
        }));

        const out = [];
        let cx = fromX;
        let cy = fromY;
        let i = 0;
        while (i < points.length) {
            // reach as far down the path as we can still see from here.  The window is
            // capped because we re-plan ten times a second - the far end of the route
            // will be re-smoothed long before we ever fly it.
            let best = i;
            const limit = Math.min(points.length - 1, i + 12);
            for (let j = limit; j > i; j--) {
                if (this.corridorClear(grid, cx, cy, points[j].x, points[j].y, radius)) {
                    best = j;
                    break;
                }
            }
            out.push(points[best]);
            cx = points[best].x;
            cy = points[best].y;
            i = best + 1;
        }
        return out;
    }

}
