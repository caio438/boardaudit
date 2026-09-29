import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

function extrairFuncao(nome) {
  const inicio = front.indexOf('function ' + nome + '(');
  assert.ok(inicio >= 0, 'Função não encontrada: ' + nome);
  const abre = front.indexOf('{', inicio);
  let nivel = 0;
  let emString = '';
  let escape = false;
  for (let i = abre; i < front.length; i += 1) {
    const caractere = front[i];
    if (emString) {
      if (escape) escape = false;
      else if (caractere === '\\') escape = true;
      else if (caractere === emString) emString = '';
      continue;
    }
    if (caractere === '"' || caractere === "'" || caractere === '`') {
      emString = caractere;
      continue;
    }
    if (caractere === '{') nivel += 1;
    if (caractere === '}') {
      nivel -= 1;
      if (nivel === 0) return front.slice(inicio, i + 1);
    }
  }
  throw new Error('Fim da função não encontrado: ' + nome);
}

const contexto = {
  statusMomentoConformeCloserFront_: item => String(item?.status || '').toUpperCase() === 'CONFORME',
  statusMomentoNaoAplicavelCloserFront_: item => ['NAO_APLICAVEL', 'NAO_EVIDENCIADO'].includes(String(item?.status || '').toUpperCase()),
  statusConformeAuditoriaFront_: status => String(status || '').toUpperCase() === 'CONFORME',
  statusNaoAplicavelAuditoriaFront_: status => ['NAO_APLICAVEL', 'NAO_EVIDENCIADO'].includes(String(status || '').toUpperCase()),
  Set
};
const consolidar = vm.runInNewContext('(' + extrairFuncao('consolidarIntervencoesCloserFront_') + ')', contexto);

const auditoriaNova = {
  resumo_reuniao: {
    cenario_atual: 'O lead descreveu o processo manual atual.',
    dor_principal: 'Retrabalho na operação.'
  },
  perguntas_diagnostico: {
    perguntas_realizadas: [{
      categoria: 'Problema (SPIN)',
      pergunta: 'Onde o retrabalho mais acontece?',
      aprofundou: false,
      avaliacao: 'PARCIAL',
      o_que_melhorar: 'Peça um exemplo recente e identifique quem é afetado.'
    }],
    perguntas_esperadas_nao_realizadas: [{
      categoria: 'Implicação (SPIN)',
      pergunta: 'Qual impacto do retrabalho na operação hoje?',
      motivo_importancia: 'Dimensionar a consequência operacional.',
      sugestao_aplicacao: 'Logo após o lead confirmar o retrabalho.'
    }]
  },
  repertorio_perguntas_sugeridas: [{
    categoria: 'Implicação (SPIN)',
    pergunta_sugerida: 'Hoje, qual é o impacto que o retrabalho causa na operação?',
    quando_usar: 'Depois de validar o problema.',
    objetivo: 'Dimensionar a consequência.',
    origem: 'SUGESTAO_ENABLEMENT'
  }, {
    categoria: 'Necessidade de solução (SPIN)',
    pergunta_sugerida: 'Se esse retrabalho fosse reduzido, o que mudaria no resultado do time?',
    quando_usar: 'Depois de dimensionar o impacto.',
    objetivo: 'Construir valor com a resposta do lead.',
    origem: 'SUGESTAO_ENABLEMENT'
  }, {
    categoria: 'Situação (SPIN)',
    pergunta_sugerida: 'Qual ferramenta vocês usam hoje?',
    quando_usar: 'Para entender o processo atual.',
    objetivo: 'Mapear o contexto.',
    origem: 'SUGESTAO_ENABLEMENT'
  }],
  objecoes_respostas: [{ melhoria_sugerida: 'Confirme a dúvida sobre prazo e responda com o marco de implantação já discutido.' }],
  proximos_passos: [{ acao: 'Confirme o próximo passo com data e responsável.', criterio_conclusao: 'Convite aceito.' }]
};

const novas = consolidar(auditoriaNova);
assert.ok(novas.length >= 3 && novas.length <= 5, 'Visão executiva deve conter no máximo cinco intervenções prioritárias.');
assert.ok(novas.some(item => item.includes('Implicação (SPIN)')), 'Pergunta de Implicação não foi consolidada.');
assert.ok(novas.some(item => item.includes('Necessidade de solução (SPIN)')), 'Pergunta de Necessidade não foi consolidada.');
assert.ok(novas.some(item => item.includes('Problema (SPIN)')), 'Aprofundamento de Problema já detectado não foi reaproveitado.');
assert.ok(!novas.some(item => item.includes('Situação (SPIN)')), 'Pergunta de Situação foi forçada apesar de o contexto já estar evidenciado.');
assert.equal(novas.filter(item => /impacto.*opera[cç][aã]o|opera[cç][aã]o.*impacto/i.test(item)).length, 1, 'Perguntas semanticamente equivalentes não foram deduplicadas.');

const contextoAusente = consolidar({
  resumo_reuniao: { cenario_atual: 'Não evidenciado', dor_principal: 'Não evidenciado' },
  perguntas_diagnostico: { perguntas_realizadas: [], perguntas_esperadas_nao_realizadas: [] },
  repertorio_perguntas_sugeridas: [{
    categoria: 'Situação (SPIN)',
    pergunta_sugerida: 'Como funciona o processo atual de atendimento?',
    quando_usar: 'No início, porque o cenário atual não foi esclarecido.',
    objetivo: 'Entender o contexto essencial antes de explorar o problema.',
    origem: 'SUGESTAO_ENABLEMENT'
  }]
});
assert.ok(contextoAusente.some(item => item.includes('Situação (SPIN)')), 'Situação deveria ser preservada quando falta contexto essencial.');

const auditoriaAntiga = consolidar({
  resumo_reuniao: {},
  perguntas_diagnostico: {
    perguntas_realizadas: [],
    perguntas_esperadas_nao_realizadas: [{ categoria: 'Diagnóstico', pergunta: 'Quem participa da decisão?', sugestao_aplicacao: 'Antes de apresentar a proposta.' }]
  },
  momentos: [{ status: 'DESVIO_EXECUCAO', nome: 'Fechamento', o_que_fazer: 'Ofereça duas opções objetivas de agenda para o próximo passo.' }]
});
assert.ok(auditoriaAntiga.length > 0, 'Auditoria antiga, sem novos campos SPIN, deixou de produzir coaching executivo.');
assert.ok(auditoriaAntiga.length <= 5, 'Auditoria antiga excedeu o limite executivo.');

console.log('Resumo executivo Closer validado: SPIN contextual, deduplicação, prioridade, limite e compatibilidade legada.');
