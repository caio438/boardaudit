import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const rdSource = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
const consumoSource = fs.readFileSync(new URL('./ConsumoIA.gs', import.meta.url), 'utf8');
const Utilities = { formatDate: data => new Date(data).toISOString() };
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite, Utilities };
vm.createContext(context);
vm.runInContext(source + '\nthis.api={criteria:audV3CriteriosCloser_,normalize:audV3NormalizarResultado_,validateOfficial:audV3ValidarResultadoOficial_,validateBoard:audV3ValidarQualidadeBoard_,promptOfficial:audV3PromptOficial_,schema:audV3SchemaResposta_,apiSchema:audV3SchemaRespostaApi_,documentText:audV3TextoDocumento_};', context);

const criterios = context.api.criteria();
const momentos = criterios.momentos.map((item, index) => ({
  id: item.id,
  nome: item.nome,
  status: index === 2 ? 'VERMELHO' : 'VERDE',
  gatilho_alcancado: index !== 2,
  o_que_se_espera: item.objetivo,
  o_que_foi_dito: 'Evidência objetiva da transcrição.',
  locutor_evidencia: 'CLOSER',
  divergencia: index === 2 ? 'A solução não foi conectada ao impacto declarado.' : 'Não houve divergência.',
  justificativa_nota: index === 2 ? 'Gatilho não alcançado.' : 'Gatilho alcançado sem desvio relevante.',
  pontos_fortes: ['Boa condução'],
  pontos_melhorar: index === 2 ? ['Não confirmou o próximo passo'] : [],
  o_que_fazer: 'Aplicar o comportamento esperado.',
  texto_script: 'Exemplo recomendado.',
  como_agir: 'Confirmar e registrar.',
  aulas_revisar: [],
  timestamp_inicio: ['00:00', '03:00', '17:00', '46:00'][index],
  timestamp_fim: ['03:00', '17:00', '46:00', '1:03:50'][index]
}));
const criteriosAvaliados = criterios.dimensoes.map(item => ({
  id: item.id,
  nome: item.nome,
  aplicavel: true,
  status: 'CONFORME',
  o_que_foi_dito: 'Evidência objetiva da transcrição.',
  locutor_evidencia: 'CLOSER',
  regra_pitch: 'Comportamento obrigatório descrito no pitch.',
  divergencia: 'Não houve divergência.',
  correcao_pratica: 'Manter a execução.',
  pontuacao: 4.5,
  justificativa_nota: 'Execução consistente e aderente.'
}));
const checklist = criterios.checklist.map(item => ({ item, resultado: 'SIM', observacao: 'Evidenciado.' }));
const resultado = context.api.normalize(
  {
    momentos,
    criterios_avaliados: criteriosAvaliados,
    checklist,
    semaforo_geral: { justificativa: 'Um gatilho não alcançado.' },
    proximos_passos: [
      { acao: 'Revisar o processo', responsavel: 'Caio', equipe: 'NAO_DEFINIDA' },
      { acao: 'Ajustar a campanha', responsavel: 'Allafy', equipe: 'NAO_DEFINIDA' }
    ]
  },
  criterios,
  { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead', empresaArquivo: '', numeroChamada: '' },
  { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z'), DURACAO_SEGUNDOS: 3830 },
  { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
  'CLOSER'
);

if (resultado.momentos.length !== 4) throw new Error('Quantidade de momentos inválida.');
if (resultado.semaforo !== 'AMARELO') throw new Error('Semáforo deveria ser AMARELO.');
if (resultado.pontuacao_calculada.score_5 !== 5) throw new Error('Score oficial deve ser calculado deterministicamente pelo status.');
if (resultado.checklist.length !== criterios.checklist.length) throw new Error('Checklist derivado incompleto.');
if (resultado.metadados.closer !== 'Closer Teste') throw new Error('Closer não identificado.');
if (!resultado.analise_temporal.mensuravel) throw new Error('Timestamps válidos deveriam produzir análise temporal completa.');
if (resultado.analise_temporal.duracao_total !== '63 min 50 s') throw new Error('Duração total da reunião não foi normalizada.');
if (resultado.analise_temporal.diagnostico.duracao_minutos !== 17) throw new Error('Duração do diagnóstico calculada incorretamente.');
if (resultado.analise_temporal.fechamento.inicio !== '46:00') throw new Error('Timestamp do fechamento não foi preservado.');
if (resultado.proximos_passos_por_equipe.sales_ops.length !== 1) throw new Error('Tarefa do Caio não foi classificada em Sales Ops.');
if (resultado.proximos_passos_por_equipe.midia.length !== 1) throw new Error('Tarefa do Allafy não foi classificada em Mídia.');
if (!resultado.resumo_publicacao.proximos_passos_sales_ops.length || !resultado.resumo_publicacao.proximos_passos_midia.length) throw new Error('Resumo não separou próximos passos por equipe.');

const criteriosContraditorios = JSON.parse(JSON.stringify(criteriosAvaliados));
criteriosContraditorios[0].divergencia = 'A pergunta obrigatória não foi feita.';
const resultadoReconciliado = context.api.normalize(
  { momentos: JSON.parse(JSON.stringify(momentos)), criterios_avaliados: criteriosContraditorios, checklist: JSON.parse(JSON.stringify(checklist)) },
  criterios,
  { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead' },
  { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z'), DURACAO_SEGUNDOS: 3830 },
  { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
  'CLOSER'
);
if (resultadoReconciliado.criterios_avaliados[0].status !== 'DESVIO_EXECUCAO') throw new Error('Contradição real deveria ser reconciliada como desvio.');
if (resultadoReconciliado.criterios_avaliados[0].pontuacao !== 2.5) throw new Error('Desvio deve receber a nota oficial fixa de 2,5.');
if (!resultadoReconciliado.criterios_avaliados[0].divergencia_identificada) throw new Error('A divergência reconciliada precisa permanecer explícita no JSON.');

const criteriosSemDivergencia = JSON.parse(JSON.stringify(criteriosAvaliados));
criteriosSemDivergencia[0].divergencia = 'Não foram identificadas divergências relevantes.';
criteriosSemDivergencia[0].pontuacao = 3.5;
const resultadoVariacaoLinguistica = context.api.normalize(
  { momentos: JSON.parse(JSON.stringify(momentos)), criterios_avaliados: criteriosSemDivergencia, checklist: JSON.parse(JSON.stringify(checklist)) },
  criterios,
  { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead' },
  { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z'), DURACAO_SEGUNDOS: 3830 },
  { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
  'CLOSER'
);
if (resultadoVariacaoLinguistica.criterios_avaliados[0].status !== 'CONFORME') throw new Error('Variação linguística sem divergência foi interpretada como erro.');
if (resultadoVariacaoLinguistica.criterios_avaliados[0].pontuacao !== 5) throw new Error('Conforme deve receber a nota oficial fixa de 5,0.');

context.api.validateOfficial(
  resultado,
  'CLOSER',
  criterios,
  'Evidência objetiva da transcrição.',
  'Comportamento obrigatório descrito no pitch.'
);

const resultadoComEvidenciaInventada = JSON.parse(JSON.stringify(resultado));
resultadoComEvidenciaInventada.criterios_avaliados[0].o_que_foi_dito = 'Frase que não existe na transcrição.';
assert.throws(
  () => context.api.validateOfficial(resultadoComEvidenciaInventada, 'CLOSER', criterios, 'Evidência objetiva da transcrição.', 'Comportamento obrigatório descrito no pitch.'),
  /não foi localizada na transcrição original/,
  'Uma evidência inventada precisa bloquear a auditoria oficial.'
);

const promptModelado = 'PROMPT OFICIAL CLOSER TESTE';
if (context.api.promptOfficial({ PROMPT_AUDITORIA: promptModelado, TIPO_AUDITORIA: 'CLOSER' }, 'CLOSER') !== promptModelado) {
  throw new Error('O motor não está usando o prompt salvo no modelo como fonte oficial.');
}

const schemaSemNota = context.api.schema('CLOSER');
if (schemaSemNota.properties.criterios_avaliados.items.properties.pontuacao) {
  throw new Error('A IA ainda pode definir pontuação diretamente no schema Closer.');
}

const schemaCompleto = context.api.schema('CLOSER');
const schemaApi = context.api.apiSchema('CLOSER');
if (!schemaCompleto.properties.semaforo_geral) throw new Error('Schema final Closer perdeu campos derivados.');
if (schemaApi.properties.semaforo_geral) throw new Error('Schema enviado à API ainda contém campo derivado.');
if (!schemaApi.properties.momentos || !schemaApi.properties.analise_impacto_implicacao) {
  throw new Error('Schema compacto perdeu campos analíticos essenciais.');
}
if (schemaApi.required.length >= schemaCompleto.required.length) {
  throw new Error('Schema Closer enviado à API não foi efetivamente simplificado.');
}
if (!context.api.schema('SDR').properties.aderencia_script) throw new Error('Schema SDR foi afetado.');
if (!source.includes("if (tipo === 'PLANO') generationConfig.responseSchema")) {
  throw new Error('SDR ou Closer ainda podem receber o responseSchema complexo recusado pelo Gemini.');
}
const inicioChamada = source.indexOf('function audV3ChamarGemini_');
const inicioPrompt = source.indexOf('function audV3MontarPrompt_', inicioChamada);
const trechoChamada = source.slice(inicioChamada, inicioPrompt);
if (!trechoChamada.includes('const generationConfig') || !trechoChamada.includes('generationConfig: generationConfig')) {
  throw new Error('A configuração condicional não está dentro da chamada de auditoria.');
}
const trechoFormalizacao = source.slice(source.indexOf('function formalChamarGemini_'), source.indexOf('function formalMontarPrompt_'));
assert.match(source, /esperasRetentativaMs:\s*\[0,\s*3000,\s*8000\]/, 'A retentativa gradual do Gemini não está configurada.');
assert.match(trechoFormalizacao, /AUDITORIA_V3\.esperasRetentativaMs\.slice\(\)/, 'A formalização não usa a política de retentativa.');
assert.match(source.slice(inicioChamada, source.indexOf('function audV3MontarPrompt_')), /AUDITORIA_V3\.esperasRetentativaMs\.slice\(\)/, 'A auditoria não usa a política de retentativa.');
assert.match(consumoSource, /function consumoIaModelosTextoDisponiveis_\(\)/, 'A lista de modelos alternativos não está disponível.');
assert.match(trechoFormalizacao, /consumoIaModelosTextoDisponiveis_\(\)/, 'A formalização não troca de modelo após indisponibilidade temporária.');
assert.match(trechoChamada, /consumoIaModelosTextoDisponiveis_\(\)/, 'A auditoria não troca de modelo após indisponibilidade temporária.');
if (trechoFormalizacao.includes("tipo === 'PLANO'")) {
  throw new Error('A configuração Closer vazou para a formalização.');
}
if (!source.includes('<SCHEMA_SAIDA_OBRIGATORIO>')) {
  throw new Error('O contrato JSON Closer não foi preservado no prompt.');
}
if (context.api.documentText('', 'Não evidenciado.') !== 'Não evidenciado.') {
  throw new Error('Campo vazio ainda pode quebrar a geração do Google Docs.');
}
if (context.api.documentText('', '') !== '') {
  throw new Error('A normalização de itens vazios das listas está incorreta.');
}
if (!source.includes("linha.map(valor => audV3TextoDocumento_(valor, 'Não evidenciado.'))")) {
  throw new Error('As células vazias das tabelas não estão protegidas para o Google Docs.');
}


const inicioRdCloser = rdSource.indexOf('function audRdTextoCloser_');
const fimRdCloser = rdSource.indexOf('function audRdTextoSdr_', inicioRdCloser);
const trechoRdCloser = rdSource.slice(inicioRdCloser, fimRdCloser);
assert.ok(inicioRdCloser >= 0 && fimRdCloser > inicioRdCloser, 'Formatter Closer do RD não foi localizado.');
assert.doesNotMatch(trechoRdCloser, /DESVIOS EM RELAÇÃO AO PITCH\/PROCESSO/, 'A seção antiga de desvios voltou ao texto do RD.');
assert.match(trechoRdCloser, /PERGUNTAS REALIZADAS PELO CLOSER/, 'O RD precisa listar as perguntas realizadas pelo Closer.');
assert.match(trechoRdCloser, /PERGUNTAS DO PITCH QUE DEVERIAM TER SIDO FEITAS/, 'O RD precisa listar perguntas obrigatórias ausentes.');
assert.match(trechoRdCloser, /IMPLICAÇÃO E NECESSIDADE — O QUE DEVERIA TER SIDO EXPLORADO/, 'O RD precisa explicitar implicações e necessidades que deveriam ter sido aprofundadas.');
assert.match(trechoRdCloser, /Pergunta do pitch para aprofundar:/, 'O RD precisa usar perguntas concretas do pitch na orientação de implicação.');
assert.match(trechoRdCloser, /AJUSTES OBJETIVOS PARA A PRÓXIMA REUNIÃO/, 'O RD precisa transformar gaps em ações objetivas.');
assert.match(trechoRdCloser, /pergunte "/, 'O RD precisa dizer literalmente qual pergunta o Closer deve fazer.');
assert.match(trechoRdCloser, /duas opções objetivas de agenda/, 'O RD precisa ter exemplo objetivo de agendamento quando houver gap de próximo passo.');
assert.match(trechoRdCloser, /ACORDO DE PRÓXIMO PASSO/, 'O RD precisa exibir o acordo de próximo passo.');
assert.match(trechoRdCloser, /PONTUAÇÃO DE QUALIDADE/, 'O RD precisa exibir a pontuação por critério.');
assert.match(trechoRdCloser, /SUGESTÕES DE APROFUNDAMENTO/, 'O RD precisa separar sugestões de enablement das perguntas do pitch.');
assert.match(trechoRdCloser, /Pontos fortes:/, 'A conclusão precisa usar pontos fortes objetivos.');
assert.match(trechoRdCloser, /Prioridade prática para a próxima reunião:/, 'A conclusão precisa resumir ações executáveis, sem orientação genérica.');
assert.doesNotMatch(trechoRdCloser, /O principal ajuste está em:/, 'A conclusão genérica antiga voltou ao RD.');
assert.doesNotMatch(trechoRdCloser, /Na prática, revisar/, 'A conclusão voltou a orientar revisão genérica em vez de execução concreta.');
assert.match(source, /COACHING CLOSER OBRIGATÓRIO/, 'O prompt não bloqueia recomendações genéricas para Closer.');
assert.match(source, /pergunta exata, frase sugerida, sequência de perguntas, duas opções concretas de agenda/, 'O prompt não exige comportamento observável para o coaching.');
assert.match(source, /REGRA DE QUALIDADE DO FEEDBACK/, 'O prompt não exige que a orientação seja utilizável diretamente pelo gestor.');
assert.match(trechoRdCloser, /function coachingAcionavelCloser/, 'O formatter do RD não possui filtro de coaching acionável.');
assert.match(trechoRdCloser, /REVISAR\|MELHORAR\|APROFUNDAR/, 'O formatter do RD não bloqueia verbos genéricos sem execução concreta.');
assert.match(trechoRdCloser, /execute conforme a regra do pitch/, 'O RD não possui fallback concreto para regra literal do pitch.');
assert.match(trechoRdCloser, /nenhuma ação adicional foi incluída porque não havia orientação específica/, 'O RD voltou a preencher coaching sem evidência concreta.');


const schemaCloserContexto = context.api.schema('CLOSER');
assert.ok(schemaCloserContexto.properties.contexto_interacao, 'O schema Closer precisa classificar o contexto da reunião.');
assert.ok(context.api.apiSchema('CLOSER').properties.contexto_interacao, 'O contexto precisa ser solicitado na mesma chamada de IA.');

const negociacaoValida = {
  contexto_interacao: {
    classificacao: 'NEGOCIACAO',
    momento_jornada: 'NEGOCIACAO',
    objetivo_principal: 'Resolver condição comercial e confirmar decisão',
    confianca: 'ALTA',
    evidencias: ['Se chegar nessa condição, conseguimos fechar.'],
    etapas_aplicaveis: ['Negociação', 'Confirmação da decisão', 'Próximo passo'],
    etapas_ja_concluidas: ['Diagnóstico', 'Apresentação da solução'],
    etapas_nao_aplicaveis: ['Descoberta inicial'],
    continuidade_confirmada: true,
    evidencia_continuidade: 'Histórico local registra apresentação anterior.',
    necessita_revisao: false,
    motivo_revisao: ''
  },
  criterios_avaliados: [
    { aplicavel: true, status: 'DESVIO_EXECUCAO', correcao_pratica: 'Pergunte "Se chegarmos nessa condição, existe outro ponto que impediria o fechamento?"' }
  ],
  proximos_passos: [
    { acao: 'Confirme responsável e prazo de decisão antes de encerrar.' }
  ],
  momentos: [
    { status: 'NAO_APLICAVEL' },
    { status: 'NAO_APLICAVEL' },
    { status: 'NAO_APLICAVEL' },
    { status: 'AMARELO', como_agir: 'Confirme condição, contrapartida e prazo de decisão.' }
  ],
  perguntas_diagnostico: { perguntas_esperadas_nao_realizadas: [] }
};
const gateNegociacao = context.api.validateBoard(negociacaoValida, 'CLOSER');
assert.notEqual(gateNegociacao.status, 'BLOQUEADO', 'Negociação com coaching específico não deve ser bloqueada.');



const negociacaoSemContinuidade = JSON.parse(JSON.stringify(negociacaoValida));
negociacaoSemContinuidade.contexto_interacao.continuidade_confirmada = false;
negociacaoSemContinuidade.contexto_interacao.evidencia_continuidade = '';
const gateSemContinuidade = context.api.validateBoard(negociacaoSemContinuidade, 'CLOSER');
assert.equal(gateSemContinuidade.status, 'BLOQUEADO', 'Etapas anteriores não podem ser dispensadas sem prova de continuidade.');

const primeiraReuniaoComProposta = JSON.parse(JSON.stringify(negociacaoValida));
primeiraReuniaoComProposta.contexto_interacao = {
  classificacao: 'PRIMEIRA_REUNIAO',
  momento_jornada: 'PROPOSTA',
  objetivo_principal: 'Diagnosticar, demonstrar e apresentar proposta na mesma reunião',
  confianca: 'ALTA',
  evidencias: ['Não há reunião Closer anterior no histórico local.'],
  etapas_aplicaveis: ['Diagnóstico', 'Apresentação da solução', 'Fechamento'],
  etapas_ja_concluidas: [],
  etapas_nao_aplicaveis: [],
  continuidade_confirmada: false,
  evidencia_continuidade: '',
  necessita_revisao: false,
  motivo_revisao: ''
};
const gatePrimeiraComProposta = context.api.validateBoard(primeiraReuniaoComProposta, 'CLOSER');
assert.notEqual(gatePrimeiraComProposta.status, 'BLOQUEADO', 'Primeira reunião pode conter proposta sem dispensar diagnóstico.');

const autoriaErrada = JSON.parse(JSON.stringify(negociacaoValida));
autoriaErrada.perguntas_diagnostico = {
  perguntas_realizadas: [
    {
      pergunta: 'Você tem um teto de orçamento?',
      resposta_lead: 'Ainda não está fechado, mas esse valor ficou bem alto do que comentaram internamente.'
    }
  ],
  perguntas_esperadas_nao_realizadas: []
};
autoriaErrada.criterios_avaliados[0].o_que_foi_dito = 'esse valor ficou bem alto do que comentaram internamente';
const gateAutoria = context.api.validateBoard(autoriaErrada, 'CLOSER');
assert.equal(gateAutoria.status, 'BLOQUEADO', 'Fala do lead atribuída ao Closer precisa bloquear publicação.');
assert.match(gateAutoria.bloqueios.join(' '), /autoria/i);

const negociacaoCobradaComoDiagnostico = JSON.parse(JSON.stringify(negociacaoValida));
negociacaoCobradaComoDiagnostico.perguntas_diagnostico.perguntas_esperadas_nao_realizadas = Array.from({ length: 7 }, (_, i) => ({ pergunta: 'Pergunta ' + i }));
const gateDiagnosticoIndevido = context.api.validateBoard(negociacaoCobradaComoDiagnostico, 'CLOSER');
assert.equal(gateDiagnosticoIndevido.status, 'REVISAR', 'Negociação com diagnóstico completo cobrado novamente deve exigir revisão.');

console.log(`Teste Closer contextual válido: schema da API reduzido de ${schemaCompleto.required.length} para ${schemaApi.required.length} blocos obrigatórios, mantendo análise, contexto e gate.`);
