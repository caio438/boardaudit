import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');

function trecho(source, inicio, fim) {
  const de = source.indexOf(inicio);
  const ate = source.indexOf(fim, de + inicio.length);
  assert.ok(de >= 0 && ate > de, `Trecho não encontrado: ${inicio}`);
  return source.slice(de, ate);
}

const ingestor = trecho(
  code,
  'function consolidarTarefasRdCliente_',
  'function buscarPaginaTarefasRd_'
);

assert.match(ingestor, /type:\s*'call'/, 'A consulta ao RD precisa pedir somente ligações.');
assert.match(ingestor, /done:\s*true/, 'A consulta ao RD precisa pedir somente tarefas concluídas.');
assert.doesNotMatch(ingestor, /criarGrupoResumoRd_|acumularTarefaRd_|salvarResumoRd_/, 'O ingestor não pode alimentar RESUMO_TAREFAS_RD.');
assert.match(ingestor, /salvarLigacoesRdEmLote_/, 'As ligações precisam ser persistidas em INTERACOES.');

const parserSource = [
  trecho(code, 'function extrairDescricaoTarefaRd_', 'function normalizarTextoNotaRd_'),
  trecho(code, 'function normalizarTextoNotaRd_', 'function extrairDuracaoLigacaoRd_'),
  trecho(code, 'function extrairUrlGravacaoApi4comTarefa_', 'function extrairLeadTarefaRd_'),
  trecho(code, 'function tarefaLigacaoRdPossuiGravacao_', 'function criarRegistroLigacaoRd_')
].join('\n');
const context = vm.createContext({});
vm.runInContext(parserSource + '\nthis.aceita=tarefaLigacaoRdPossuiGravacao_;', context);

assert.equal(context.aceita({
  id: '123',
  type: 'call',
  done: true,
  notes: 'Duração: 02:10 https://media.api4com.com/records/call.mp3?token=x'
}), true);
assert.equal(Boolean(context.aceita({
  id: '124', type: 'call', done: true, notes: 'Ligação concluída', recording_url: 'https://media.api4com.com/call.mp3'
})), false, 'O MP3 precisa estar na descrição da tarefa.');
assert.equal(Boolean(context.aceita({ type: 'task', done: true, notes: 'https://media.api4com.com/call.mp3' })), false);
assert.equal(Boolean(context.aceita({ type: 'call', done: false, notes: 'https://media.api4com.com/call.mp3' })), false);
assert.equal(Boolean(context.aceita({ type: 'call', done: true, notes: 'https://example.com/call.mp3' })), false);

const persistencia = trecho(code, 'function salvarLigacoesRdEmLote_', 'function extrairDescricaoTarefaRd_');
assert.match(persistencia, /'RD_TASK_'\s*\+\s*idTarefa/, 'A deduplicação precisa usar RD_TASK_<id>.');
assert.match(persistencia, /existentes\[idExterno\]/, 'A persistência precisa atualizar a interação deduplicada.');

assert.match(code, /RD_API4COM_INGESTAO_ATIVA/);
assert.match(code, /RD_API4COM_PIPELINE_ATIVO/);
assert.match(code, /PROCESSAR_PIPELINE_RD_API4COM/);
assert.match(code, /origemInternaApi4com:\s*true/);
assert.match(code, /const BOARD_MODE = 'MANUAL';/, 'As demais automações precisam permanecer em modo manual.');
assert.match(code, /function ATIVAR_PIPELINE_SDR_ISOLADO\(\)/, 'Ativacao isolada do SDR nao foi implementada.');
assert.match(code, /publicacaoAutomatica:\s*true/, 'Ativacao isolada do SDR precisa confirmar publicacao automatica.');
assert.match(code, /aprovacaoAutomatica:\s*true/, 'Ativacao isolada do SDR precisa confirmar aprovacao automatica.');
assert.match(code, /sdrRemoverAcionadoresNaoPermitidos_\(\)/, 'Ativacao isolada nao remove acionadores de automacoes fora do SDR.');
assert.match(code, /reconciliarAcionadorRd_\(\)/, 'Ativacao isolada nao instala ingestao diaria RD\/API4COM.');
assert.match(code, /reconciliarWatchdogPipelineRdApi4com_\(\)/, 'Ativacao isolada precisa instalar watchdog recorrente.');
assert.match(code, /WATCHDOG_PIPELINE_RD_API4COM/, 'Watchdog SDR isolado ausente.');
assert.match(code, /AUDITORIA_AUTO_LIGACOES_CUTOFF_ISO/, 'Cutoff do backlog antigo ausente.');
assert.match(code, /function garantirIngestaoSdrRecente_/, 'Watchdog nao garante ingestao recorrente do RD.');
assert.match(code, /function WATCHDOG_PIPELINE_RD_API4COM\(\)[\s\S]*garantirIngestaoSdrRecente_\(\)/, 'Watchdog precisa consultar e persistir ligacoes recentes antes de acordar o pipeline.');
assert.match(code, /dataFim:\s*hoje/, 'Janela incremental precisa incluir o dia corrente.');
assert.match(code, /diasSobreposicaoIngestao:\s*1/, 'Ingestao precisa rever o dia anterior para absorver atrasos do RD.');
assert.match(code, /garantirIngestaoSdrRecente_\(\{ desdeCutoff: true \}\)/, 'Ativacao isolada precisa recuperar somente a janela desde o cutoff.');


const executor = trecho(
  audit,
  'function EXECUTAR_AUTOMACAO_LIGACOES_V3',
  'function audV3Lista_'
);
assert.match(executor, /transcreverAudioMp3V4/);
assert.match(executor, /tipoAuditoria:\s*'SDR'/);
assert.match(executor, /executarAuditoriaV3/);
assert.match(executor, /audV3FinalizarAutomaticamente_/, 'O pipeline SDR novo precisa aprovar e publicar automaticamente apos os gates.');
assert.match(executor, /rdFinal\.publicada\s*!==\s*true/, 'O lote precisa tratar publicacao RD nao confirmada como falha recuperavel.');
assert.match(audit, /cutoffMs/, 'A fila SDR precisa aplicar o cutoff temporal.');

assert.match(audit, /function audV3ExigirGatePublicavel_/);
assert.match(audit, /BLOQUEADO[\s\S]*não pode ser aprovada\/publicada/);

console.log('Ingestor RD/API4COM validado com cutoff, watchdog e publicacao automatica do SDR.');
