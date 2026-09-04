PACKAGE_NAME := gforcex-js-wasm
DIST_ARCHIVE := dist/$(PACKAGE_NAME).zip
DIST_FILES := README.md LICENSE index.html main.css server.js cookie.js const.js sound.js orb.js map.js ship.js turret.js nav.js enemy.js resources wasm/dist/terrain.wasm wasm/terrain-inline.js wasm/terrain-bridge.js

.PHONY: build test dist serve

build:
	npm --prefix wasm run build

test:
	npm --prefix wasm test

dist: build
	mkdir -p dist
	zip -q -FSr $(DIST_ARCHIVE) $(DIST_FILES)
	@echo "Created $(DIST_ARCHIVE)"

serve:
	node server.js
