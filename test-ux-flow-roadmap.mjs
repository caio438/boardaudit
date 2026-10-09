import fs from 'node:fs';
import assert from 'node:assert/strict';

const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

const fluxos = {
  AUDITORIA: [
    'Ligação encontrada',
    'Auditoria gerada',
    'Revisão',
    'Aprovada e enviada ao RD'
  ],
  FORMALIZACAO: [
    'Reunião encontrada',
    'Formalização gerada',
    'Revisão',
    'Aprovada e tarefas criadas'
  ],
  PLANO: [
    'Fonte selecionada',
    'Plano gerado',
    'Revisão',
    'Aprovado'
  ],
  TAREFAS: [
    'Criada',
    'Em andamento',
    'Concluída'
  ]
};

assert.match(front, /const FLUXOS_UX_BOARD = Object\.freeze\(/, 'Definição única dos fluxos UX ausente.');
for (const [chave, etapas] of Object.entries(fluxos)) {
  assert.match(front, new RegExp(chave + ': Object\\.freeze\\('), 'Fluxo ' + chave + ' ausente.');
  for (const etapa of etapas) {
    assert.ok(front.includes("titulo: '" + etapa.replaceAll("'", "\\'") + "'"), 'Etapa ausente em ' + chave + ': ' + etapa);
  }
}

assert.match(front, /id="auditFlowStepper"/, 'Stepper operacional de auditoria ausente.');
assert.match(front, /id="formalFlowStepper"/, 'Stepper operacional de formalização ausente.');
assert.match(front, /id="tarefasFlowStepper"/, 'Stepper operacional de tarefas ausente.');
assert.match(front, /id="guiaFluxosOperacionais"/, 'Guia não usa o mesmo motor visual dos fluxos.');
assert.match(front, /function renderizarGuiaFluxosFront_\(\)/, 'Renderização do guia por definição compartilhada ausente.');
assert.match(front, /renderizarStepperFluxoFront_\('guiaFluxo_' \+ chave, chave/, 'Guia não reutiliza o mesmo stepper das telas.');
assert.match(front, /function renderizarFluxoAuditoriaFront_\(\)/, 'Estado real da auditoria não alimenta o stepper.');
assert.match(front, /function renderizarFluxoFormalizacaoFront_\(\)/, 'Estado real da formalização não alimenta o stepper.');
assert.match(front, /function renderizarFluxoTarefasFront_\(\)/, 'Estado real das tarefas não alimenta o stepper.');
assert.match(front, /rdStatus \|\| ''\)\.toUpperCase\(\) === 'PUBLICADA'/, 'Auditoria só pode concluir a etapa final quando o RD estiver publicado.');
assert.match(front, /String\(atual\.status \|\| ''\)\.toUpperCase\(\) === 'APROVADA'/, 'Aprovação não está refletida no fluxo.');
assert.match(front, /A aprovação alimenta automaticamente a fila de tarefas\./, 'Fluxo de formalização não explicita criação de tarefas.');
assert.match(front, /<details class="card ux-technical-details">/, 'Detalhes técnicos não foram movidos para camada secundária.');
assert.match(front, /Hash, snapshots e versões de normalização/, 'Camada técnica não explica integridade.');
assert.match(front, /Roadmap técnico/, 'Roadmap técnico precisa ficar separado do roadmap funcional.');
assert.match(front, /O roadmap funcional é o mesmo fluxo que você executa nas telas\./, 'Subtítulo do Guia ainda descreve um fluxo diferente.');
assert.match(front, /<option value="PENDENTE">Criada<\/option>/, 'Status visual de tarefa ainda usa Pendente em vez de Criada.');
assert.match(front, /return \{ PENDENTE: 'Criada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' \}/, 'Rótulo de tarefa não está alinhado ao fluxo.');
assert.match(front, /ehPlano[\s\S]*?'Gerar plano'/, 'Plano ainda usa ação visual de gerar auditoria.');
assert.match(front, /Novo Plano de Otimização/, 'Plano não possui título operacional próprio.');
assert.match(front, /Mesmos nomes, mesma ordem, mesmos ícones e mesmas etapas\./, 'Guia não declara paridade com a operação.');
assert.match(front, /const permitirImportacaoManual = !closerSimplificado && Boolean\(idCliente\);/, 'A importação manual deve aparecer no Plano após selecionar o cliente.');
assert.match(front, /if \(tipoEspaco === 'CLOSER' \|\| !valor\('audCliente'\)\)/, 'O painel manual deve ficar indisponível só para Closer ou sem cliente.');
assert.match(front, /id="audLoteLigacoesManual"/, 'Lote de ligações deve possuir contêiner isolado.');
assert.match(front, /if \(lote\) lote.style.display = \(ativo \|\| ehPlano\) \? 'none' : '';/, 'Lote deve ser oculto para Closer e Plano.');
assert.match(front, /if \(tipoInteracao === 'PLANO'\) return fonteInteracao === 'MANUAL';/, 'Transcrições manuais do Plano devem permanecer selecionáveis.');

console.log('UX validado: Guia/Roadmap e telas operacionais usam a mesma definição de fluxo.');
