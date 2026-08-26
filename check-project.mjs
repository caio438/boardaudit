import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
if (!scripts.length) throw new Error('Nenhum bloco de script encontrado.');
for (const script of scripts) new Function(script);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicados = [...new Set(ids.filter((id, indice) => ids.indexOf(id) !== indice))];
if (duplicados.length) throw new Error(`IDs HTML duplicados: ${duplicados.join(', ')}`);

const scriptCompleto = scripts.join('\n');
const funcoes = new Set([...scriptCompleto.matchAll(/\bfunction\s+([\w$]+)\s*\(/g)].map(match => match[1]));
const onclicks = [...html.matchAll(/\bonclick="([^"]+)"/g)].map(match => match[1]);
const chamadasDiretas = onclicks
  .map(codigo => codigo.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/)?.[1])
  .filter(Boolean);
const ausentes = [...new Set(chamadasDiretas.filter(nome => !funcoes.has(nome)))];
if (ausentes.length) throw new Error(`Ações sem função declarada: ${ausentes.join(', ')}`);

const paginas = [...html.matchAll(/\bdata-page="([^"]+)"/g)].map(match => match[1]);
const semSecao = [...new Set(paginas.filter(nome => !html.includes(`id="page-${nome}"`)))];
if (semSecao.length) throw new Error(`Navegação sem página: ${semSecao.join(', ')}`);

const arquivosGs = fs.readdirSync(dir).filter(nome => nome.endsWith('.gs'));
const funcoesGs = new Map();
for (const nome of arquivosGs) {
  const conteudo = fs.readFileSync(path.join(dir, nome), 'utf8');
  new Function(conteudo);
  for (const match of conteudo.matchAll(/\bfunction\s+([\w$]+)\s*\(/g)) {
    const lista = funcoesGs.get(match[1]) || [];
    lista.push(nome);
    funcoesGs.set(match[1], lista);
  }
}
const duplicadasGs = [...funcoesGs.entries()].filter(([, arquivos]) => arquivos.length > 1);
if (duplicadasGs.length) {
  throw new Error(`Funções .gs duplicadas: ${duplicadasGs.map(([nome, arquivos]) => `${nome} (${arquivos.join(', ')})`).join('; ')}`);
}

console.log(JSON.stringify({
  scriptsValidos: scripts.length,
  idsUnicos: ids.length,
  botoesComAcao: onclicks.length,
  paginasNavegaveis: [...new Set(paginas)].length,
  arquivosGsValidos: arquivosGs.length,
  funcoesGsUnicas: funcoesGs.size
}, null, 2));
