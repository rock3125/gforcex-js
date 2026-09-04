import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [bridgeSource, wasmBytes] = await Promise.all([
    readFile(new URL('../terrain-bridge.js', import.meta.url), 'utf8'),
    readFile(new URL('../dist/terrain.wasm', import.meta.url))
]);

const context = vm.createContext({
    WebAssembly,
    atob(encoded) {
        return Buffer.from(encoded, 'base64').toString('binary');
    },
    fetch: async () => {
        throw new TypeError('Network fetch is blocked for file URLs');
    },
    window: {
        GForceTerrainWasmBase64: wasmBytes.toString('base64')
    }
});

vm.runInContext(bridgeSource, context);
const terrain = await context.window.WasmTerrain.create();

terrain.exports.generateWorld(0x5eed1234);
assert.equal(terrain.exports.getTile(0, 0), 1);
console.log('WASM terrain bridge falls back to embedded bytes when fetch is unavailable.');
