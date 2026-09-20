import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const codigo = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const contexto = vm.createContext({ console });
vm.runInContext(codigo + '\nthis.apiV5={criteria:audV3CriteriosSdr_,validateOfficial:audV3ValidarResultadoOficial_,schema:audV3SchemaRespostaSdr_,promptOfficial:audV3PromptOficial_};', contexto);

const resultado = {
  etapas_pitch: [
    { etapa: 'Introdução', status: 'DESVIO_EXECUCAO', fato_transcricao: 'Olá, tudo bem?', locutor_evidencia: 'SDR', regra_pitch: 'Apresentar-se como especialista e validar três minutos.', desvio: 'Não informou o papel nem validou o tempo.', correcao_pratica: 'Apresentar-se e confirmar os três minutos.' },
    { etapa: 'Primeira Frase de Qualificação', status: 'CONFORME', fato_transcricao: 'Quero entender seu cenário.', locutor_evidencia: 'SDR', regra_pitch: 'Qualificar antes de agendar.', desvio: 'Não houve divergência.' },
    { etapa: 'Pergunta de Segmento', status: 'CONFORME', fato_transcricao: 'Qual é o segmento?', locutor_evidencia: 'SDR', regra_pitch: 'Perguntar o segmento.', desvio: 'Não houve divergência.' },
    { etapa: 'Validação de LMV', status: 'NAO_EXECUTADA', fato_transcricao: 'Não evidenciado na fala do SDR.', locutor_evidencia: 'NAO_IDENTIFICADO', regra_pitch: 'Validar os critérios de LMV.', desvio: 'A validação obrigatória não foi executada.' },
    { etapa: 'Manejo de Objeções', status: 'NAO_APLICAVEL', fato_transcricao: 'Não evidenciado na fala do SDR.', locutor_evidencia: 'NAO_IDENTIFICADO', regra_pitch: 'Aplicar contorno quando houver objeção.', desvio: '' },
    { etapa: 'Encerramento Profissional', status: 'CONFORME', fato_transcricao: 'Podemos marcar amanhã às 10h?', locutor_evidencia: 'SDR', regra_pitch: 'Oferecer próximo passo concreto.', desvio: 'Não houve divergência.' }
  ],
  aderencia_script: {
    resumo_aderencia: 'Executou a maior parte do pitch, com desvio na introdução e ausência de LMV.',
    introducao: {
      elementos_esperados: ['Apresentar-se como especialista', 'Validar três minutos'],
      elementos_identificados: [],
      elementos_ausentes: ['Apresentar-se como especialista', 'Validar três minutos']
    }
  },
  perguntas_qualificacao: {
    resumo: 'Uma pergunta correta, uma desviada e uma ausente.',
    corretas: [{ pergunta: 'Qual é o segmento?', locutor: 'SDR', evidencia: 'Qual é o segmento?', regra_pitch: 'Perguntar o segmento.', por_que_esta_correta: 'Preservou o objetivo.' }],
    com_desvio: [{ pergunta: 'Seu faturamento é cinco mil?', locutor: 'SDR', evidencia: 'É cinco mil?', regra_pitch: 'Pergunta aberta de LMV.', erro_ou_desvio: 'Pergunta induzida.', correcao_pratica: 'Perguntar de forma aberta.', impacto: 'Pode limitar a qualificação.' }],
    ausentes: [{ pergunta_esperada: 'O que motivou seu contato?', regra_pitch: 'Investigar motivação.', impacto_ausencia: 'Reduz contexto.', como_perguntar: 'O que motivou seu contato conosco?' }]
  }
};

contexto.audV3NormalizarLeiturasSdr_(resultado, { checklist: [] });

assert.equal(resultado.aderencia_script.etapas_previstas, 5);
assert.equal(resultado.aderencia_script.etapas_executadas, 4);
assert.equal(resultado.aderencia_script.etapas_conformes, 3);
assert.equal(resultado.aderencia_script.cobertura_pitch_percentual, 80);
assert.equal(resultado.aderencia_script.aderencia_pitch_percentual, 60);
assert.equal(resultado.aderencia_script.introducao.evidencia, 'Olá, tudo bem?');
assert.equal(resultado.perguntas_qualificacao.status_geral, 'PARCIAL');
assert.equal(resultado.perguntas_qualificacao.total_corretas, 1);
assert.equal(resultado.perguntas_qualificacao.total_com_desvio, 1);
assert.equal(resultado.perguntas_qualificacao.total_ausentes, 1);

assert.equal(resultado.etapas_pitch[0].nota, 2.5);
assert.equal(resultado.etapas_pitch[3].nota, 0);
assert.equal(resultado.etapas_pitch[4].nota, null);

const contraditorio = {
  etapas_pitch: [{
    etapa: 'Primeira Frase de Qualificação',
    status: 'CONFORME',
    fato_transcricao: 'Quero entender melhor o seu cenário.',
    locutor_evidencia: 'SDR',
    regra_pitch: 'Qualificar antes de propor o agendamento.',
    desvio: 'A qualificação ocorreu depois da tentativa de agendamento.'
  }]
};
contexto.audV3NormalizarLeiturasSdr_(contraditorio, { checklist: [] });
assert.equal(contraditorio.etapas_pitch[0].status, 'DESVIO_EXECUCAO');
assert.equal(contraditorio.etapas_pitch[0].nota, 2.5);
assert.equal(contraditorio.etapas_pitch[0].divergencia_identificada, true);
assert.match(contraditorio.etapas_pitch[0].desvio, /qualificação ocorreu depois/i);

const criteriosOficiais = contexto.apiV5.criteria();
const evidenciaOficial = 'Qual é o segmento?';
const regraOficial = 'Comportamento obrigatório do pitch.';
const resultadoOficialSdr = {
  criterios_avaliados: criteriosOficiais.dimensoes.map(item => ({
    id: item.id,
    nome: item.nome,
    aplicavel: true,
    status: 'CONFORME',
    o_que_foi_dito: evidenciaOficial,
    locutor_evidencia: 'SDR',
    regra_pitch: regraOficial,
    divergencia: 'Não houve divergência.',
    correcao_pratica: 'Manter a execução.',
    pontuacao: 5,
    justificativa_nota: 'Execução conforme.'
  })),
  etapas_pitch: criteriosOficiais.checklist.map(nome => ({
    etapa: nome,
    status: 'CONFORME',
    fato_transcricao: evidenciaOficial,
    locutor_evidencia: 'SDR',
    regra_pitch: regraOficial,
    desvio: 'Não houve divergência.'
  })),
  perguntas_qualificacao: { corretas: [], com_desvio: [], ausentes: [] },
  pontuacao_calculada: { score_5: 5, itens_avaliados: 5 }
};

contexto.apiV5.validateOfficial(
  resultadoOficialSdr,
  'SDR',
  criteriosOficiais,
  'SDR: ' + evidenciaOficial,
  regraOficial
);

const sdrComEvidenciaInventada = JSON.parse(JSON.stringify(resultadoOficialSdr));
sdrComEvidenciaInventada.etapas_pitch[0].fato_transcricao = 'Frase inventada pelo modelo.';
assert.throws(
  () => contexto.apiV5.validateOfficial(sdrComEvidenciaInventada, 'SDR', criteriosOficiais, 'SDR: ' + evidenciaOficial, regraOficial),
  /não foi localizada na transcrição original/,
  'Evidência não presente na transcrição precisa bloquear a auditoria SDR.'
);

const sdrComRegraInventada = JSON.parse(JSON.stringify(resultadoOficialSdr));
sdrComRegraInventada.etapas_pitch[0].regra_pitch = 'Regra inexistente no pitch.';
assert.throws(
  () => contexto.apiV5.validateOfficial(sdrComRegraInventada, 'SDR', criteriosOficiais, 'SDR: ' + evidenciaOficial, regraOficial),
  /não foi localizada literalmente no pitch oficial/,
  'Regra não presente no pitch precisa bloquear a auditoria SDR.'
);

const schemaSdr = contexto.apiV5.schema();
if (schemaSdr.properties.criterios_avaliados.items.properties.pontuacao) {
  throw new Error('A IA ainda pode definir pontuação diretamente no schema SDR.');
}
if (!schemaSdr.properties.criterios_avaliados.items.properties.locutor_evidencia) {
  throw new Error('O schema SDR não exige rastreabilidade do locutor da evidência.');
}

const promptTeste = 'PROMPT OFICIAL SDR TESTE';
assert.equal(
  contexto.apiV5.promptOfficial({ PROMPT_AUDITORIA: promptTeste, TIPO_AUDITORIA: 'SDR' }, 'SDR'),
  promptTeste
);

console.log('Estrutura SDR da produção atual validada.');
