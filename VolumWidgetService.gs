/**
 * VOLUM Intelligence — núcleo consultivo para a widget privada do RD.
 * Sem endpoint HTTP e sem escrita no RD. A extensão futura só entrega o dealId.
 *
 * Pré-requisito: VolumIntelligenceLead.gs e ConsumoIA.gs carregados no mesmo projeto.
 */
const VOLUM_WIDGET = Object.freeze({
  emailsAutorizados: ['crm@govolum.com', 'caio@govolum.com'],
  versao: '0.1.0'
});

function VOLUM_WIDGET_AUDITAR_NEGOCIACAO(dealId, identidade, opcoes) {
  const email = String(identidade || '').trim().toLowerCase();
  if (VOLUM_WIDGET.emailsAutorizados.indexOf(email) < 0) {
    throw new Error('Acesso privado nao autorizado para esta widget.');
  }
  const leitura = VOLUM_ANALISAR_LEAD(dealId, { incluirTextos: true });
  if (leitura.modo !== 'SOMENTE_LEITURA') {
    throw new Error('A auditoria foi interrompida: modo de leitura invalido.');
  }
  const parecer = viWidgetParecerDeterministico_(leitura);
  const usarGemini = Boolean(opcoes && opcoes.usarGemini === true);
  if (usarGemini && parecer.contextoIa.length) {
    parecer.interpretacao = viWidgetInterpretarGemini_(parecer.contextoIa, dealId);
  }
  delete parecer.contextoIa;
  return parecer;
}

function viWidgetParecerDeterministico_(leitura) {
  const atividades = Array.isArray(leitura.atividades) ? leitura.atividades : [];
  const tarefas = Array.isArray(leitura.tarefas) ? leitura.tarefas : [];
  const textos = atividades.filter(a => a.textoDisponivel).map(a => ({
    data: a.data, fonte: a.tipo, texto: viWidgetSanitizar_(a.texto)
  }));
  const corpus = textos.map(x => x.texto).join('\n').toLowerCase();
  const respostas = textos.filter(x => /\b(j[aá] resolvi|outra empresa|n[aã]o [eé] hora|n[aã]o atendeu|desmarc|reagend)/i.test(x.texto));
  const haResposta = textos.some(x => /\b(obrigado|sim|n[aã]o|j[aá]|resolvi|empresa)\b/i.test(x.texto));
  const concorrente = /outra empresa|concorrente|j[aá] resolvi/i.test(corpus);
  const lmvConfirmado = /faturamento confirmado|faturamento mensal.*(?:r\$|mil)/i.test(corpus);
  const agenda = tarefas.some(t => t.tipo === 'meeting') || /agendad[oa]|reuni[aã]o.*(?:às|as)\s*\d/i.test(corpus);
  const atual = String((leitura.negociacao || {}).etapaAtualId || '');
  const anteriores = [
    viWidgetAgenteLead_(leitura),
    viWidgetAgenteCadencia_(leitura, textos),
    viWidgetAgenteConexao_(haResposta, lmvConfirmado, concorrente, agenda)
  ];
  const atualAgente = agenda ? 'AGENDA' : 'CONEXAO';
  const proxima = concorrente
    ? 'Fazer uma tentativa contextual sobre a solucao contratada; sem abertura, recomendar perda por concorrente.'
    : (haResposta && !lmvConfirmado
      ? 'Validar faturamento exato, segmento, sistema atual, dor e motivador antes de agendar.'
      : 'Executar a proxima tentativa contextual prevista para esta etapa.');
  return {
    versao: VOLUM_WIDGET.versao,
    modo: 'SOMENTE_LEITURA_CONSULTIVO',
    dealId: leitura.dealId,
    negociacao: { nome: String((leitura.negociacao || {}).nome || ''), etapaAtualId: atual },
    agenteAtual: atualAgente,
    agentesExecutados: anteriores,
    agentesNaoAplicaveis: agenda ? ['REUNIAO', 'RECOVERY'] : ['AGENDA', 'REUNIAO', 'RECOVERY'],
    status: concorrente ? 'ATENCAO_NEGATIVA_CONCORRENTE' : (lmvConfirmado ? 'EM_ANDAMENTO' : 'LMV_PENDENTE'),
    proximaAcao: proxima,
    bloqueiosDeAvanco: agenda ? [] : ['Nao avancar para Agenda sem pitch e LMV confirmados.'],
    evidencias: respostas.slice(0, 8),
    limites: ['Ausencia de evidencia nao prova ausencia de execucao.', 'Tarefas concluidas nao comprovam tentativa individual sem fonte de canal.'],
    contextoIa: textos.slice(-12)
  };
}

function viWidgetAgenteLead_(leitura) {
  const lead = (leitura.cerebros || []).filter(x => x.agente === 'LEAD')[0] || {};
  return { agente: 'LEAD', status: lead.estado || 'DADOS_INSUFICIENTES', indicadores: lead.indicadores || {} };
}
function viWidgetAgenteCadencia_(leitura, textos) {
  const cad = (leitura.cerebros || []).filter(x => x.agente === 'CADENCIA')[0] || {};
  return { agente: 'CADENCIA', status: cad.estado || 'DADOS_INSUFICIENTES',
    evidenciaTexto: textos.length, indicadores: cad.indicadores || {} };
}
function viWidgetAgenteConexao_(haResposta, lmvConfirmado, concorrente, agenda) {
  return { agente: 'CONEXAO',
    status: concorrente ? 'NEGATIVA_CONCORRENTE' : (lmvConfirmado ? 'QUALIFICACAO_EVIDENCIADA' : 'LMV_PENDENTE'),
    respostaObservada: haResposta, lmvConfirmado: lmvConfirmado,
    agendaObservada: agenda };
}
function viWidgetSanitizar_(texto) {
  return String(texto || '').replace(/https?:\/\/[^\s<>"']+/gi, '[LINK_OMITIDO]')
    .replace(/\b\d{10,13}\b/g, '[TELEFONE_OMITIDO]').slice(0, 1800);
}
function viWidgetInterpretarGemini_(contexto, dealId) {
  const modelo = consumoIaModeloTextoGratuito_();
  consumoIaValidarAntes_(modelo);
  const inicio = Date.now();
  const chave = obterSegredo_('GEMINI_API_KEY');
  if (!chave) throw new Error('Gemini nao configurado no projeto.');
  const prompt = 'Classifique a evidencia comercial. Responda APENAS JSON com status, lmv, confianca e proximaAcao. Nao invente fatos. Evidencias: ' +
    JSON.stringify(contexto);
  const resposta = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': chave },
    payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 350, responseMimeType: 'application/json' } }),
    muteHttpExceptions: true
  });
  const status = resposta.getResponseCode(), corpo = resposta.getContentText();
  registrarConsumoIa_(modelo, 'WIDGET_ANALISE_LEAD', status, corpo, '', inicio,
    { idAuditoria: String(dealId || ''), tipoAuditoria: 'WIDGET' });
  if (status < 200 || status >= 300) return { disponivel: false, motivo: 'IA_INDISPONIVEL' };
  try {
    const json = JSON.parse(corpo || '{}');
    const partes = (((json.candidates || [])[0] || {}).content || {}).parts || [];
    return JSON.parse(partes.map(p => p.text || '').join(''));
  } catch (e) { return { disponivel: false, motivo: 'RESPOSTA_IA_INVALIDA' }; }
}
