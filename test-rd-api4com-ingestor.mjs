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
assert.match(code, /publicacaoAutomatica:\s*false/, 'Ativacao isolada do SDR nao protege contra publicacao automatica.');
assert.match(code, /aprovacaoAutomatica:\s*false/, 'Ativacao isolada do SDR nao protege contra aprovacao automatica.');
assert.match(code, /sdrRemoverAcionadoresNaoPermitidos_\(\)/, 'Ativacao isolada nao remove acionadores de automacoes fora do SDR.');
assert.match(code, /reconciliarAcionadorRd_\(\)/, 'Ativacao isolada nao instala ingestao diaria RD\/API4COM.');
assert.match(code, /agendarPipelineRdApi4com_\(\)/, 'Ativacao isolada nao inicia o backlog SDR existente.');


const executor = trecho(
  audit,
  'function EXECUTAR_AUTOMACAO_LIGACOES_V3',
  'function audV3Lista_'
);
assert.match(executor, /transcreverAudioMp3V4/);
assert.match(executor, /tipoAuditoria:\s*'SDR'/);
assert.match(executor, /executarAuditoriaV3/);
assert.doesNotMatch(executor, /audV3FinalizarAutomaticamente_|aprovarAuditoriaV3|audRdPublicarAutomaticamente_/, 'O pipeline automático não pode aprovar ou publicar antes da revisão e dos gates.');

assert.match(audit, /function audV3ExigirGatePublicavel_/);
assert.match(audit, /BLOQUEADO[\s\S]*não pode ser aprovada\/publicada/);

console.log('Ingestor RD/API4COM exclusivo, deduplicado e isolado do BOARD_MODE validado.');
