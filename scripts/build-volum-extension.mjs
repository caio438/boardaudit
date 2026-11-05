#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'extensions', 'volum-intelligence');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
const version = manifest.version;
const expected = ['content.js','manifest.json','options.html','options.js','service-worker.js','sidebar.css','sidebar.html','sidebar.js'];

if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) throw new Error('manifest.version deve ser numérico para a Chrome Web Store.');
for (const file of expected) {
  const path = join(source, file);
  if (!statSync(path).isFile()) throw new Error('Arquivo obrigatório ausente: ' + file);
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

const entries = expected.map(name => {
  const data = readFileSync(join(source, name));
  const filename = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(filename.length),u16(0),filename,data]);
  return { name, filename, data, crc, local };
});
let offset = 0;
const central = entries.map(entry => {
  const value = Buffer.concat([Buffer.from([0x50,0x4b,0x01,0x02]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(entry.crc),u32(entry.data.length),u32(entry.data.length),u16(entry.filename.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),entry.filename]);
  offset += entry.local.length;
  return value;
});
const centralData = Buffer.concat(central);
const archive = Buffer.concat([...entries.map(x => x.local), centralData, Buffer.from([0x50,0x4b,0x05,0x06]),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralData.length),u32(offset),u16(0)]);
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
const out = join(dist, 'volum-intelligence-chrome-' + version + '.zip');
rmSync(out, { force: true });
writeFileSync(out, archive);
writeFileSync(join(dist, 'volum-intelligence-release.json'), JSON.stringify({ name: manifest.name, version, package: basename(out), files: expected }, null, 2) + '\n');
console.log(out);
