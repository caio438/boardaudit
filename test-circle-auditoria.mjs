import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const contexto = vm.createContext({ console });
for (const arquivo of ['PublicacaoComunidade.gs', 'PublicacaoCircle.gs']) {
  vm.runInContext(fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8'), contexto, { filename: arquivo });
}

const auditoria = { TIPO_AUDITORIA: 'SDR', STATUS: 'APROVADA', SCORE_GLOBAL: 3.4 };
const cliente = { NOME_CLIENTE: 'Tecnosoft' };
const interacao = {
  TITULO: 'Negociação de teste',
  URL_GRAVACAO: 'https://example.com/audio.mp3'
};
const resultado = {
  resumo_contato: {
    resumo_conversa: 'O lead buscou melhorar seu processo comercial.',
    motivacao_contato: 'Aumentar a conversão.',
    necessidade_principal: 'Padronizar a qualificação.',
    resultado_contato: 'Reunião não agendada.'
  },
  resumo_publicacao: {
    titulo: '[Tecnosoft + VOLUM] Auditoria SDR | Negociação de teste',
    resumo: 'A abordagem qualificou o segmento, mas não validou LMV.',
    highlights: [{ ponto: 'Segmento identificado', evidencia: 'Lead informou atuação industrial', impacto: 'Permitiu contextualizar a conversa' }],
    correcoes_prioritarias: [{ acao: 'Validar LMV em sequência', criterio_conclusao: 'Três critérios registrados' }],
    proximos_passos: ['Aplicar o roteiro na próxima ligação.']
  },
  feedback: { pontos_fortes: [], areas_melhoria: ['Evitar antecipar o agendamento.'] },
  impactos_nao_conformidades: [{
    criterio: 'Validação de LMV',
    evidencia: 'Dados coletados sem sequência',
    impacto_de_nao_executar: 'Pode encaminhar oportunidades sem aderência.',
    beneficio_de_corrigir: 'Aumenta a qualidade dos agendamentos.'
  }],
  proximos_passos: [
    { acao: 'Revisar a automação', equipe: 'SALES_OPS', responsavel: 'Thiago', prazo_dias: 2, criterio_conclusao: 'Fluxo validado' },
    { acao: 'Ajustar a campanha', equipe: 'MIDIA', responsavel: 'Luis', prazo_dias: 3, criterio_conclusao: 'Campanha revisada' }
  ]
};

const manual = vm.runInContext('comunidadeMontarPublicacaoAuditoria_', contexto)(auditoria, cliente, interacao, resultado);
assert.match(manual.conteudo, /Desvios identificados/);
assert.match(manual.conteudo, /O que deve melhorar/);
assert.match(manual.conteudo, /Por que isso importa/);
assert.match(manual.conteudo, /Próximos passos de Sales Ops/);
assert.match(manual.conteudo, /Próximos passos de Mídia/);
assert.match(manual.conteudo, /Thiago/);
assert.match(manual.conteudo, /Luis/);
assert.match(manual.conteudo, /Ouvir gravação/);
assert.doesNotMatch(manual.conteudo, /—/);
assert.ok(manual.conteudo.split('\n').length > 10, 'A versão manual deve preservar a estrutura em blocos.');

const automatico = vm.runInContext('circleMontarPublicacaoAuditoria_', contexto)(auditoria, cliente, interacao, resultado);
const serializado = JSON.stringify(automatico);
assert.match(serializado, /Desvios identificados/);
assert.match(serializado, /Por que isso importa/);
assert.match(serializado, /audio\.mp3/);

console.log('Publicação de auditoria SDR para o Circle validada.');
