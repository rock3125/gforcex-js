/* global WebAssembly */
(function () {
    class WasmTerrain {
        constructor(exports) {
            this.exports = exports;
        }

        static async create() {
            try {
                const response = await fetch('wasm/dist/terrain.wasm');
                if (!response.ok) throw new Error(`WASM terrain failed to load: ${response.status}`);
                return WasmTerrain.instantiate(await response.arrayBuffer());
            } catch (fetchError) {
                const encodedWasm = window.GForceTerrainWasmBase64;
                if (typeof encodedWasm !== 'string') throw fetchError;
                return WasmTerrain.instantiate(WasmTerrain.decodeBase64(encodedWasm));
            }
        }

        static async instantiate(bytes) {
            const imports = {
                env: {
                    abort(message, fileName, line, column) {
                        throw new Error(`WASM terrain aborted at ${line}:${column}`);
                    }
                }
            };
            const { instance } = await WebAssembly.instantiate(bytes, imports);
            return new WasmTerrain(instance.exports);
        }

        /** Decode the generated inline module for file:// launches. */
        static decodeBase64(encodedWasm) {
            const binary = atob(encodedWasm);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) {
                bytes[index] = binary.charCodeAt(index);
            }
            return bytes.buffer;
        }

        generateWorld(seed) {
            this.exports.generateWorld(seed >>> 0);
            const grid = Array.from({ length: GRID_RES }, (_, x) =>
                Array.from({ length: GRID_RES }, (_, y) => this.exports.getTile(x, y)));
            const materials = Array.from({ length: GRID_RES }, (_, x) =>
                Array.from({ length: GRID_RES }, (_, y) => this.exports.getMaterial(x, y)));
            return { grid, materials };
        }

        damageTile(x, y, hitsToDestroy) {
            return this.exports.damageTile(x, y, hitsToDestroy);
        }

        getDamage(x, y) {
            return this.exports.getDamage(x, y);
        }
    }

    window.WasmTerrain = WasmTerrain;
})();
