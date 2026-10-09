import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

assert.match(html, /id="audEquipePlano" onchange="atualizarSeletoresAuditoria\(\)"/);
assert.match(html, /Interações-base <span class="muted">\(recentes deste cliente\)<\/span>/);
assert.match(html, /usarTranscricaoManualAuditoriaFront_/);
assert.match(html, /const opcoes = Array\.from\(select\.options \|\| \[\]\)\.filter\(opcao => opcao\.value\);/);
assert.match(html, /ehPlano && Boolean\(idCliente\) \? 'flex' : 'none'/);
assert.match(html, /tipoInteracao === 'PLANO'/);
assert.match(html, /const pertenceAoCliente = String\(interacao\.idCliente \|\| ''\) === String\(idCliente \|\| ''\);/);
assert.match(html, /if \(!pertenceAoCliente\) return false;/);
assert.match(html, /if \(equipePlano === 'SDR'\) return tipoInteracao === 'LIGACAO';/);
assert.match(html, /if \(equipePlano === 'CLOSER'\) return tipoInteracao === 'REUNIAO';/);
assert.match(html, /\.slice\(0, ehPlano \? 12 : 50\)/);
assert.match(html, /reunioes\.style\.display = tipo === 'CLOSER' \? '' : 'none';/);
assert.match(html, /volumeRd\.style\.display = 'none';/);
assert.match(html, /performance\.style\.display = tipo === 'PLANO' \? 'none' : '';/);

console.log('UX dos espaços validada: SDR sem blocos operacionais redundantes e Plano isolado.');
