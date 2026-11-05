#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'extensions', 'volum-intelligence');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
const files = ['content.js','manifest.json','options.html','options.js','service-worker.js','sidebar.css','sidebar.html','sidebar.js'];
const zipPath = join(root, 'dist', 'volum-intelligence-chrome-' + manifest.version + '.zip');
assert.ok(existsSync(zipPath), 'Pacote ausente: execute scripts/build-volum-extension.mjs');
assert.equal(manifest.manifest_version, 3);
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:\.\d+)?$/);
assert.deepEqual(manifest.host_permissions, ['https://crm.rdstation.com/*'], 'O pacote não pode ampliar o acesso a hosts.');
assert.ok(!JSON.stringify(manifest).match(/script\.google\.com/i), 'O endpoint privado não pertence ao manifest.');
const zip = readFileSync(zipPath);
const observed = [];
let pos = 0;
while (pos + 30 <= zip.length && zip.readUInt32LE(pos) === 0x04034b50) {
  const size = zip.readUInt32LE(pos + 22), nameLength = zip.readUInt16LE(pos + 26), extra = zip.readUInt16LE(pos + 28);
  const name = zip.subarray(pos + 30, pos + 30 + nameLength).toString('utf8');
  const start = pos + 30 + nameLength + extra, end = start + size;
  assert.equal(zip.readUInt16LE(pos + 8), 0, 'O pacote deve usar ZIP store para revisão reprodutível.');
  assert.ok(end <= zip.length, 'Entrada ZIP truncada.');
  assert.equal(zip.subarray(start, end).toString('utf8'), readFileSync(join(source, name), 'utf8'), 'Pacote diverge da fonte: ' + name);
  observed.push(name); pos = end;
}
assert.deepEqual(observed, files);
assert.equal(zip.readUInt32LE(pos), 0x02014b50, 'Central directory ausente.');
console.log('VOLUM extension package valid: ' + manifest.version);
