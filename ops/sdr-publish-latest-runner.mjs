import fs from 'node:fs';
import os from 'node:os';

const issueNumber = 142;
const rawCommand = process.env.SDR_BATCH_COMMAND || '/sdr-publish-latest 20';
const m = rawCommand.match(/^\/sdr-publish-latest\s+(\d+)\s*$/);
if (!m) throw new Error('Comando SDR invalido.');
const limit = Math.min(20, Math.max(1, Number(m[1] || 20)));

const clasp = JSON.parse(fs.readFileSync(os.homedir() + '/.clasprc.json', 'utf8'));
const token =
  clasp?.tokens?.default?.access_token ||
  clasp?.token?.access_token ||
  clasp?.access_token || '';
if (!token) throw new Error('Access token Google ausente.');

const base = 'https://script.google.com/macros/s/AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/exec';

async function call(params, timeoutMs) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + raw.slice(0, 500));
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first < 0 || last < first) throw new Error('Resposta sem JSON.');
    return JSON.parse(raw.slice(first, last + 1));
  } finally {
    clearTimeout(timer);
  }
}

const targets = await call({ ops_sdr_batch_targets: 1, limit }, 180000);
if (targets?.sucesso !== true) throw new Error('Falha ao selecionar alvos SDR.');
const selected = Array.isArray(targets.alvos) ? targets.alvos : [];

const results = [];
for (const item of selected) {
  const id = String(item.idInteracao || '');
  if (!id) continue;
  try {
    const result = await call({ ops_sdr_publish_one: 1, interaction: id }, 420000);
    results.push(result);
  } catch (error) {
    results.push({
      sucesso: false,
      classificacao: 'ERRO_HTTP',
      idInteracaoSolicitada: id,
      erro: String(error?.message || error)
    });
  }
}

const byId = Object.fromEntries(selected.map(x => [x.idInteracao, x]));
const counts = {};
for (const r of results) counts[r.classificacao || 'SEM_CLASSIFICACAO'] = (counts[r.classificacao || 'SEM_CLASSIFICACAO'] || 0) + 1;

const lines = [
  '## Lote SDR — mais recentes',
  '',
  '- Selecionadas: ' + results.length,
  '- Publicadas no RD: ' + (counts.PUBLICADA || 0),
  '- Aguardando vinculo: ' + (counts.AGUARDANDO_VINCULO || 0),
  '- Revisao humana: ' + (counts.REVISAO_HUMANA || 0),
  '- Sem pitch: ' + (counts.SEM_PITCH || 0),
  '- Erro transcricao: ' + (counts.ERRO_TRANSCRICAO || 0),
  '- Erro RD/config: ' + ((counts.ERRO_RD || 0) + (counts.ERRO_RD_CONFIG || 0)),
  '- Outros erros: ' + ((counts.ERRO_AUDITORIA || 0) + (counts.ERRO_HTTP || 0)),
  '',
  '### Resultado por item'
];

for (const r of results) {
  const t = byId[r.idInteracaoSolicitada] || {};
  const out = r.result || {};
  lines.push(
    '- ' + (t.dataInteracao || '') +
    ' | ' + (t.responsavel || 'SDR') +
    ' | ' + (t.lead || 'sem lead') +
    ' | ' + (r.idInteracaoSolicitada || '') +
    ' | **' + (r.classificacao || 'SEM_CLASSIFICACAO') + '**' +
    (out.idAuditoria ? ' | ' + out.idAuditoria : '') +
    (r.erro ? ' | ' + String(r.erro).slice(0, 240) : '')
  );
}

const report = lines.join('\n');
fs.writeFileSync('/tmp/sdr-batch-report.md', report);
fs.writeFileSync('/tmp/sdr-batch-summary.json', JSON.stringify({
  issueNumber,
  limit,
  counts,
  targets: selected,
  results
}, null, 2));
console.log(report);
