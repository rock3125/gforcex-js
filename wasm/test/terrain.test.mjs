import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('../dist/terrain.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes, {
    env: { abort: () => { throw new Error('WASM terrain aborted'); } }
});
const wasm = instance.exports;
const size = wasm.GRID_RES.value;

wasm.generateWorld(0x5eed1234);
const firstWorld = [];
let openTiles = 0;
for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
        const tile = wasm.getTile(x, y);
        assert.ok(tile === 0 || tile === 1);
        assert.equal(wasm.getTile(x, 0), 1);
        assert.equal(wasm.getTile(x, size - 1), 1);
        assert.equal(wasm.getTile(0, y), 1);
        assert.equal(wasm.getTile(size - 1, y), 1);
        assert.ok(wasm.getMaterial(x, y) >= 0 && wasm.getMaterial(x, y) <= 3);
        firstWorld.push(tile);
        if (tile === 0) openTiles++;
    }
}
assert.ok(openTiles > size * size * 0.25, 'the cave should retain a substantial navigable region');

wasm.generateWorld(0x5eed1234);
const repeatedWorld = Array.from({ length: size * size }, (_, cell) =>
    wasm.getTile(Math.floor(cell / size), cell % size));
assert.deepEqual(repeatedWorld, firstWorld, 'a seed must reproduce the same cave');

let target = null;
for (let x = 1; x < size - 1 && !target; x++) {
    for (let y = 1; y < size - 1; y++) {
        if (wasm.getTile(x, y) === 1) {
            target = [x, y];
            break;
        }
    }
}
assert.ok(target, 'the cave must contain an interior rock tile');
for (let hit = 0; hit < 99; hit++) assert.equal(wasm.damageTile(target[0], target[1], 100), 1);
assert.equal(wasm.getDamage(target[0], target[1]), 99);
assert.equal(wasm.damageTile(target[0], target[1], 100), 2);
assert.equal(wasm.getTile(target[0], target[1]), 0);

console.log('WASM terrain core passed generation, determinism, and damage tests.');
