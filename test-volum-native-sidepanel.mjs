import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('extensions/volum-intelligence');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.permissions.includes('sidePanel'));
assert.deepEqual(manifest.side_panel, { default_path: 'sidebar.html' });
assert.match(serviceWorker, /chrome\.sidePanel\.open\(\{ tabId \}\)/);
assert.match(serviceWorker, /VOLUM_OPEN_PANEL/);

console.log('Native Chrome Side Panel configuration: OK');
