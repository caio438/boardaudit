import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '<!-- PATCH_START -->';
const END = '<!-- PATCH_END -->';
const SELF_PROTECTED = new Set([
  '.github/workflows/apply-chatgpt-patch.yml',
  'scripts/extract-issue-patch.mjs'
]);

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function validateRepoPath(raw) {
  let value = String(raw || '').trim();
  if (!value || value === '/dev/null') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || value.includes('\t')) {
    throw new Error('Caminho de patch com quoting/escape não suportado: ' + value);
  }
  if (value.startsWith('a/') || value.startsWith('b/')) value = value.slice(2);
  if (!value || value.startsWith('/') || value.includes('\\')) {
    throw new Error('Caminho inválido no patch: ' + value);
  }
  if (value.split('/').includes('..') || path.posix.normalize(value) !== value) {
    throw new Error('Path traversal bloqueado no patch: ' + value);
  }

  const lower = value.toLowerCase();
  const base = path.posix.basename(lower);
  const restricted =
    lower.startsWith('.github/workflows/') ||
    lower.startsWith('.github/actions/') ||
    SELF_PROTECTED.has(lower) ||
    base === '.env' ||
    base.startsWith('.env.') ||
    /(^|\/)(secrets?|credentials?|private[-_]?keys?|service[-_]?accounts?)(\/|\.|$)/i.test(lower) ||
    /\.(pem|key|p12|pfx|jks)$/i.test(lower);

  if (restricted) {
    throw new Error('Arquivo protegido não pode ser alterado pelo patch automático: ' + value);
  }
  return value;
}

export function extractPatchFromBody(body) {
  const text = String(body || '');
  if (countOccurrences(text, START) !== 1 || countOccurrences(text, END) !== 1) {
    throw new Error('A issue deve conter exatamente um par PATCH_START/PATCH_END.');
  }

  const start = text.indexOf(START) + START.length;
  const end = text.indexOf(END, start);
  if (end < start) throw new Error('PATCH_END aparece antes de PATCH_START.');

  const block = text.slice(start, end).trim();
  const match = block.match(/^\`\`\`diff\s*\n([\s\S]*?)\n\`\`\`\s*$/);
  if (!match) throw new Error('O conteúdo entre os marcadores deve ser um único bloco \`\`\`diff.');

  const patch = match[1].replace(/\r\n/g, '\n').trimEnd() + '\n';
  if (!patch.trim() || !/^diff --git /m.test(patch)) {
    throw new Error('Patch vazio ou sem cabeçalho diff --git.');
  }

  const paths = new Set();
  for (const line of patch.split('\n')) {
    let candidate = null;
    const diff = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diff) {
      [diff[1], diff[2]].forEach(item => {
        const valid = validateRepoPath(item);
        if (valid) paths.add(valid);
      });
      continue;
    }
    const header = line.match(/^(?:---|\+\+\+)\s+(.+)$/);
    if (header) candidate = header[1];
    const move = line.match(/^(?:rename|copy) (?:from|to) (.+)$/);
    if (move) candidate = move[1];
    if (candidate) {
      const valid = validateRepoPath(candidate);
      if (valid) paths.add(valid);
    }
  }

  if (!paths.size) throw new Error('Nenhum arquivo válido foi identificado no patch.');
  return { patch, paths: [...paths].sort() };
}

function runCli() {
  const [, , inputFile, outputFile] = process.argv;
  if (!inputFile || !outputFile) {
    throw new Error('Uso: node scripts/extract-issue-patch.mjs <issue-body.md> <output.patch>');
  }
  const body = fs.readFileSync(inputFile, 'utf8');
  const result = extractPatchFromBody(body);
  fs.writeFileSync(outputFile, result.patch, 'utf8');
  process.stdout.write(JSON.stringify({ arquivos: result.paths }, null, 2) + '\n');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
    process.exit(1);
  }
}
