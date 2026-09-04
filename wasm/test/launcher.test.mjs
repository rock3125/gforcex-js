import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stylesheet = await readFile(new URL('../../main.css', import.meta.url), 'utf8');

assert.match(
    stylesheet,
    /#launcher\[hidden\]\s*\{\s*display:\s*none\s*!important;/,
    'the launch screen must not override its hidden state and cover the running game'
);

console.log('Launcher hidden state overrides its grid layout.');
