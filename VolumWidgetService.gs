/**
 * VOLUM Intelligence — núcleo consultivo para a widget privada do RD.
 * Sem endpoint HTTP e sem escrita no RD. A extensão futura só entrega o dealId.
 *
 * Pré-requisito: VolumIntelligenceLead.gs e ConsumoIA.gs carregados no mesmo projeto.
 */
const VOLUM_WIDGET = Object.freeze({
  emailsAutorizados: ['crm@govolum.com', 'caio@govolum.com'],
  versao: '0.2.0'
});

function VOLUM_WIDGET_AUDITAR_NEGOCIACAO(dealId, identidade, opcoes) {
  const email = viWidgetEmailSessao_();
  const emailSolicitado = String(identidade || '').trim().toLowerCase();
  if (VOLUM_WIDGET.emailsAutorizados.indexOf(email) < 0 ||
      (emailSolicitado && emailSolicitado !== email)) {
    throw new Error('Acesso privado nao autorizado para esta widget.');
  }
  const leitura = VOLUM_ANALISAR_LEAD(dealId, { incluirTextos: true });
  if (leitura.modo !== 'SOMENTE_LEITURA') {
    throw new Error('A auditoria foi interrompida: modo de leitura invalido.');
  }
  const parecer = viWidgetParecerDeterministico_(leitura);
  const usarGemini = Boolean(opcoes && opcoes.usarGemini === true);
  if (usarGemini && parecer.contextoIa.length) {
    try {
      parecer.interpretacao = viWidgetInterpretarGemini_(parecer.contextoIa, dealId);
    } catch (e) {
      parecer.interpretacao = {disponivel:false,motivo:'IA_INDISPONIVEL'};
    }
  }
  delete parecer.contextoIa;
  return parecer;
}


function viWidgetNormalizar_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function viWidgetEtapa_(nome) {
  const etapa = viWidgetNormalizar_(nome);
  const mapa = [
    [/recovery|retomada|recuperacao|follow|proposta|negociacao/, 5, 'FOLLOW-UP / RECOVERY'],
    [/reuniao|apresentacao|demonstracao/, 4, 'REUNIÃO / CLOSER'],
    [/agenda|agendad/, 3, 'AGENDA'],
    [/contato feito|conexao|qualific|interesse/, 2, 'CONEXÃO'],
    [/sem contato|cadencia|tentativa/, 1, 'CADÊNCIA'],
    [/lead|entrada|novo/, 0, 'LEAD']
  ];
  if (/perdid|ganh|encerrad|finalizad/.test(etapa)) return {indice:6, agente:'NEGOCIAÇÃO ENCERRADA'};
  const achada = mapa.find(x => x[0].test(etapa));
  return achada ? {indice:achada[1], agente:achada[2]} :
    {indice:-1, agente:'ETAPA NÃO MAPEADA'};
}

function viWidgetCampo_(anotacoes, regex) {
  for (let i = anotacoes.length - 1; i >= 0; i--) {
    const resultado = anotacoes[i].texto.match(regex);
    if (resultado && resultado[1] && resultado[1].trim().length >= 2) {
      return {texto:viWidgetSanitizar_(resultado[1].trim()).slice(0,90),
        data:anotacoes[i].data, fonte:anotacoes[i].fonte};
    }
  }
  return null;
}

function viWidgetParecerDeterministico_(leitura) {
  const ats = Array.isArray(leitura.atividades) ? leitura.atividades : [];
  const tarefas = Array.isArray(leitura.tarefas) ? leitura.tarefas : [];
  const chamadas = Array.isArray(leitura.ligacoesBoard) ? leitura.ligacoesBoard : [];
  const fontes = leitura.fontes || {};
  const fonteAtividades = fontes.atividades || {};
  const fonteTarefas = fontes.tarefas || {};
  const nomeEtapa = String((leitura.negociacao || {}).etapaAtualNome || '');
  const etapa = viWidgetEtapa_(nomeEtapa);
  const faseCloser = etapa.indice >= 4;
  const resumo = [];
  const anotacoes = ats
    .filter(x => x && x.textoDisponivel && ['note','response','messenger','whatsapp_transcription'].includes(String(x.tipo || '').toLowerCase()))
    .map(x => ({data:String(x.data || ''), fonte:String(x.tipo || 'atividade'),
      texto:viWidgetSanitizar_(x.texto)}))
    .filter(x => x.texto)
    .sort((a,b) => a.data.localeCompare(b.data));
  const recente = anotacoes.slice(-8);
  const normal = valor => viWidgetNormalizar_(valor);
  const naoAtendeu = anotacoes.filter(x => /nao atendeu|sem resposta|caixa postal|chamada nao atendida/.test(normal(x.texto))).length;
  const resposta = anotacoes.some(x => {
    const t=normal(x.texto);
    return /(?:cliente|lead|prospect)\s+(?:respondeu|retornou|confirmou|conversou|falou)\b|(?:falamos|conversamos)\s+com\s+(?:o\s+|a\s+)?(?:cliente|lead|prospect)/.test(t)
      && !/cliente nao respondeu|lead nao respondeu|nao conseguimos contato/.test(t);
  });
  const ocorrencia = regex => recente.filter(x => regex.test(normal(x.texto))).slice(-1)[0] || null;
  const concorrente = ocorrencia(/(?:fechou|contratou|optou|escolheu)\s+(?:com\s+|por\s+)?(?:outra empresa|concorrente|outro fornecedor)|(?:resolveu|fechou)\s+com\s+(?:um\s+)?concorrente/);
  const cancelamento = ocorrencia(/reuniao\s+(?:foi\s+)?(?:cancelada|desmarcada)|(?:cancelou|desmarcou)\s+(?:a\s+)?reuniao/);
  const novaAgenda = ocorrencia(/(?:reagendamento|nova data|novo horario)\s+confirmad|reuniao\s+reagendada\s+para/);
  const agendaPendente = Boolean(cancelamento && (!novaAgenda || novaAgenda.data < cancelamento.data));
  const lmv = viWidgetCampo_(anotacoes, /(?:^|[\n;.])\s*(?:lmv|faturamento(?:\s+(?:medio|mensal))?|receita mensal)\s*[:=-]\s*([^\n;]{2,90})/im);
  const dor = viWidgetCampo_(anotacoes, /(?:^|[\n;.])\s*(?:dor|problema|desafio|objetivo)\s*[:=-]\s*([^\n;]{2,110})/im);
  const sistema = viWidgetCampo_(anotacoes, /(?:^|[\n;.])\s*(?:sistema atual|erp atual|software atual)\s*[:=-]\s*([^\n;]{2,90})/im);
  const decisor = viWidgetCampo_(anotacoes, /(?:^|[\n;.])\s*(?:decisor|tomador de decisao|responsavel pela decisao)\s*[:=-]\s*([^\n;]{2,90})/im);
  const chamadasComEvidencia = chamadas.filter(x => Boolean(x.temReferenciaGravacao) || Number(x.duracaoSegundos) > 0);
  const tarefaDeReuniao = tarefas.filter(x => x.tipo === 'meeting' || /reuniao|apresentacao/i.test(x.assunto || ''));
  const pendentes = tarefas.filter(x => !x.concluida);
  const comPrazo = pendentes.filter(x => x.previstaPara && Number.isFinite(Date.parse(x.previstaPara)))
    .sort((a,b) => Date.parse(a.previstaPara)-Date.parse(b.previstaPara));
  const vencidas = comPrazo.filter(x => Date.parse(x.previstaPara) < Date.now());
  const lote = {};
  tarefas.filter(x => x.concluida && x.concluidaEm).forEach(x => {
    const minuto=String(x.concluidaEm).slice(0,16);
    lote[minuto]=(lote[minuto] || 0)+1;
  });
  const tarefasEmLote=Object.keys(lote).some(x=>lote[x] >= 3);
  const completo = fonteAtividades.acessivel === true && fonteAtividades.completo === true
    && fonteTarefas.acessivel === true && fonteTarefas.completo === true;
  const conf = completo && anotacoes.length ? 'MÉDIA' : 'BAIXA';

  const criterio = (titulo,status,detalhe,referencia) =>
    ({titulo:titulo,status:status,detalhe:detalhe,referencia:referencia || 'Evidências consultadas'});
  const qual = [
    criterio('LMV',lmv?'INDICIO':'SEM_EVIDENCIA',lmv?'Registro textual: '+lmv.texto:'Sem informação estruturada recuperada. Confirmar com o lead.'),
    criterio('Dor / objetivo',dor?'INDICIO':'SEM_EVIDENCIA',dor?'Registro textual: '+dor.texto:'Ainda não evidenciado de forma estruturada.'),
    criterio('Sistema atual',sistema?'INDICIO':'SEM_EVIDENCIA',sistema?'Registro textual: '+sistema.texto:'Não localizado nas anotações acessíveis.'),
    criterio('Decisor',decisor?'INDICIO':'SEM_EVIDENCIA',decisor?'Registro textual: '+decisor.texto:'Não localizado nas anotações acessíveis.')
  ];
  const compliance = [
    criterio('Tentativa de contato',chamadasComEvidencia.length?'EVIDENCIADO':'SEM_EVIDENCIA',
      chamadasComEvidencia.length+' ligação(ões) com duração ou referência no board. Não comprovam conversa.',
      'Board API4COM'),
    criterio('Conexão efetiva',resposta?'INDICIO':'SEM_EVIDENCIA',
      resposta?'Anotação sugere retorno ou conversa; confirmar pelo áudio.':'Não foi identificada conversa explícita. Tarefas e chamadas não bastam.',
      'Anotações RD'),
    criterio('Qualificação antes da agenda',lmv&&dor?'INDICIO':'SEM_EVIDENCIA',
      lmv&&dor?'LMV e dor foram anotados; validar confirmação com o cliente.':'LMV e/ou dor não constam em campos textuais identificáveis.',
      'Critério operacional VOLUM'),
    criterio('Integridade da cadência',tarefasEmLote?'REVISAR':'NAO_VERIFICAVEL',
      tarefasEmLote?'Há 3 ou mais tarefas concluídas no mesmo minuto. Não contar como tentativas individuais sem prova.':'Cadência completa depende da régua aprovada e das evidências de canal.',
      'Tarefas RD')
  ];
  const criterioCloser = [
    criterio('Link da gravação da reunião','NAO_VERIFICAVEL','A coleta de ligações do board não prova a gravação de reunião do closer.','Plano Wisetec · closer'),
    criterio('Anotação privada do vendedor',ats.some(x=>x.tipo==='note' && x.textoDisponivel)?'INDICIO':'NAO_VERIFICAVEL',
      ats.some(x=>x.tipo==='note' && x.textoDisponivel)?'Há anotação RD, mas não é possível confirmar se é a anotação privada de reunião.':'O tipo e a privacidade da anotação de reunião não estão confirmados.','Plano Wisetec · closer'),
    criterio('Proposta comercial anexada em PDF','NAO_VERIFICAVEL','Anexos PDF não são coletados por este leitor. Não inferir falta de proposta.','Plano Wisetec · closer'),
    criterio('Tarefa com data e acordo de próximo passo',comPrazo.length?'INDICIO':'NAO_VERIFICAVEL',
      comPrazo.length?'Há '+comPrazo.length+' tarefa(s) abertas com data. O acordo com o lead não está comprovado.':'Nenhuma tarefa aberta com data recuperada; coleta e acordo precisam de verificação.','Plano Wisetec · closer'),
    criterio('Valores da proposta','NAO_VERIFICAVEL','Valor e coerência da proposta não estão disponíveis nesta coleta.','Plano Wisetec · closer'),
    criterio('Confirmação de recebimento da proposta','NAO_VERIFICAVEL','E-mail enviado não equivale a recebimento confirmado; falta verificação do canal.','Plano Wisetec · closer'),
    criterio('Cadência de follow-up do closer',comPrazo.length?'INDICIO':'NAO_VERIFICAVEL',
      comPrazo.length?'Há follow-ups/tarefas datados; não há régua homologada para afirmar aderência.':'A sequência de follow-up depende de régua e histórico completos.','Plano Wisetec · closer')
  ];

  const recomendacoes=[];
  function recomendar(prioridade,acao,porQue,criterioConclusao,origem) {
    recomendacoes.push({prioridade:prioridade,acao:acao,porQue:porQue,
      criterioConclusao:criterioConclusao,origem:origem || 'Orientação Sales Ops'});
  }
  if (agendaPendente) recomendar('ALTA',
    'Confirmar novo horário antes de considerar a reunião agendada.',
    'Há anotação de cancelamento sem confirmação posterior de nova data.',
    'Novo horário confirmado pelo cliente, com responsável e tarefa coerentes.','Plano Wisetec · próximo passo');
  if (concorrente) recomendar('MÉDIA',
    'Validar se a escolha de outro fornecedor encerra a oportunidade ou admite uma única retomada contextual.',
    'Uma das anotações recentes sugere escolha de concorrente; validar contexto e data.',
    'Motivo da decisão confirmado e próximo estado definido sem insistência automática.','Sales Ops · decisão');
  if (vencidas.length) recomendar('ALTA',
    'Revisar '+vencidas.length+' tarefa(s) abertas com data vencida e definir próximo passo real.',
    'Tarefa vencida não garante que houve atraso comercial; requer conferência com o responsável.',
    'Cada tarefa revisada, com evidência do resultado ou novo acordo.','Plano Wisetec · tarefa e prazo');
  if (tarefasEmLote) recomendar('MÉDIA',
    'Conferir as conclusões em lote contra ligações e outros canais.',
    'Três ou mais tarefas foram concluídas no mesmo minuto; não equivalem a três contatos.',
    'Tentativas individuais reconciliadas com gravações ou mensagens.','Sales Ops · evidências');
  if (etapa.indice === 3 && (!lmv || !dor)) recomendar('MÉDIA',
    'Confirmar LMV e dor com o lead antes de validar a passagem para a agenda.',
    'Não há registro estruturado suficiente dos dois pontos; ausência no texto não prova ausência da conversa.',
    'LMV e dor documentados com evidência rastreável.','Sales Ops · passagem de etapa');
  if (faseCloser && !comPrazo.length) recomendar('MÉDIA',
    'Revisar o próximo acordo de follow-up e sua data com o closer.',
    'Nenhuma tarefa aberta datada foi recuperada na coleta atual.',
    'Próximo passo, responsável e data confirmados com o lead.','Plano Wisetec · closer');
  if (!faseCloser && etapa.indice >= 0 && etapa.indice <= 2 && !resposta) recomendar('MÉDIA',
    'Identificar a próxima tentativa válida e registrar o resultado efetivo.',
    'Há registro de tarefas/chamadas, mas nenhuma anotação inequívoca de conversa com o lead.',
    'Canal, data e resultado verificáveis sem duplicar tentativas.','Sales Ops · cadência');
  if (etapa.indice < 0) recomendar('MÉDIA',
    'Mapear a etapa atual ao processo VOLUM antes de aplicar regras de avanço.',
    'O nome da etapa RD não está disponível ou não corresponde ao mapeamento homologado.',
    'Etapa identificada e regra de execução correspondente selecionada.','Governança · integração');
  if (!completo) recomendar('MÉDIA',
    'Completar ou conferir a cobertura das fontes antes de concluir compliance.',
    'Uma ou mais fontes RD estão inacessíveis, incompletas ou não confirmadas.',
    'Paginação e acesso das fontes validados; lacunas documentadas.','Governança · evidências');
  if (!recomendacoes.length) recomendar('BAIXA',
    'Validar a próxima ação da etapa atual com o responsável da negociação.',
    'Não surgiu alerta prioritário nas fontes consultadas; isso não atesta conformidade integral.',
    'Próxima ação e evidências correspondentes confirmadas.','Sales Ops · continuidade');

  const prioridadeOrdem={ALTA:0,MÉDIA:1,BAIXA:2};
  recomendacoes.sort((a,b) => prioridadeOrdem[a.prioridade]-prioridadeOrdem[b.prioridade]);
  const principal=recomendacoes[0];
  const situacao=agendaPendente?'REAGENDAMENTO SEM NOVA CONFIRMAÇÃO':
    concorrente?'POSSÍVEL NEGATIVA POR CONCORRENTE':
    vencidas.length?'TAREFAS VENCIDAS PARA REVISÃO':
    !completo?'COBERTURA DE DADOS INCOMPLETA':'DIAGNÓSTICO CONSULTIVO';
  const risco=agendaPendente || vencidas.length ? 'ALTO' : concorrente || !completo ? 'MÉDIO' : 'NÃO CLASSIFICADO';
  if (agendaPendente) resumo.push('Há evidência recente de cancelamento sem nova confirmação identificada.');
  if (concorrente) resumo.push('Registro recente sugere escolha de outro fornecedor; confirmar a decisão.');
  if (naoAtendeu) resumo.push(naoAtendeu+' registro(s) de não atendimento não comprovam conexão.');
  if (tarefasEmLote) resumo.push('Conclusões de tarefas no mesmo minuto exigem revisão da prova de execução.');
  if (!completo) resumo.push('A leitura RD é parcial; não é seguro atribuir nota global de compliance.');
  if (!resumo.length) resumo.push('Nenhum alerta forte identificado, mas a auditoria ainda não cobre todos os canais.');
  const mensagem=agendaPendente?
    'Olá! Para organizarmos nossa conversa, qual novo dia e horário seria melhor para vocês? Posso preparar os pontos prioritários antes da reunião.':
    concorrente?
    'Obrigado pelo retorno. Posso confirmar se a solução escolhida já atende o ponto que motivou o contato? Se estiver tudo resolvido, respeitamos a decisão.':
    '';
  const eixos=['LEAD','CADÊNCIA','CONEXÃO','AGENDA','REUNIÃO / CLOSER','FOLLOW-UP / RECOVERY'];
  const agentes=(Array.isArray(leitura.cerebros)?leitura.cerebros:[]).filter(x => {
    const idx={LEAD:0,CADENCIA:1,CONEXAO:2,AGENDA:3,REUNIAO:4}[x.agente];
    return etapa.indice >= 0 && idx !== undefined && idx <= etapa.indice;
  }).map(x => ({agente:x.agente, status:x.estado, indicadores:x.indicadores || {}}));
  return {
    versao:VOLUM_WIDGET.versao, modo:'SOMENTE_LEITURA_CONSULTIVO', dealId:leitura.dealId,
    negociacao:{nome:String((leitura.negociacao || {}).nome || ''), etapaAtualId:String((leitura.negociacao || {}).etapaAtualId || ''),etapaAtualNome:nomeEtapa || 'Não informada'},
    agenteAtual:etapa.agente,agentesExecutados:agentes,
    agentesNaoAplicaveis:etapa.indice >= 0 ? eixos.slice(Math.min(etapa.indice+1,eixos.length)) : [],
    status:situacao, risco:risco, confianca:conf,
    resumoExecutivo:resumo, proximaAcao:principal.acao,
    regraDeDecisao:principal.criterioConclusao,
    mensagemSugerida:mensagem, plano:{status:situacao,acao:principal.acao,mensagem:mensagem,regra:principal.criterioConclusao},
    recomendacoes:recomendacoes.slice(0,5),compliance:compliance,
    qualificacao:qual, criteriosPlanoWisetec:faseCloser?criterioCloser:[],
    fontesCobertura:[
      criterio('Atividades RD',fonteAtividades.acessivel === true?(fonteAtividades.completo === true?'CONSULTADA':'PARCIAL'):'NAO_VERIFICAVEL',
        fonteAtividades.acessivel === true?'Consulta de atividades '+(fonteAtividades.completo === true?'completa':'incompleta')+'.':'Consulta não confirmada.'),
      criterio('Tarefas RD',fonteTarefas.acessivel === true?(fonteTarefas.completo === true?'CONSULTADA':'PARCIAL'):'NAO_VERIFICAVEL',
        fonteTarefas.acessivel === true?'Consulta de tarefas '+(fonteTarefas.completo === true?'completa':'incompleta')+'.':'Consulta não confirmada.'),
      criterio('Ligações board','CONSULTADA','Vínculos por ID de negociação; ligação não comprova conversa.'),
      criterio('Propostas PDF, e-mail, gravação de reunião','NAO_VERIFICAVEL','Não há coleta autenticada e completa desses canais nesta versão.')
    ],
    evidenciasResumo:{atividades:ats.length,anotacoesInterpretaveis:anotacoes.length,
      tarefas:tarefas.length,ligacoesComprovadas:chamadasComEvidencia.length,
      registrosNaoAtendeu:naoAtendeu,tarefasEmLote:tarefasEmLote,tarefasVencidas:vencidas.length,
      tarefasReuniao:tarefaDeReuniao.length},
    bloqueiosDeAvanco:[],evidencias:recente.slice(-6).reverse().map(x=>({
      data:x.data,fonte:x.fonte,texto:x.texto.slice(0,240)})),
    limites:['Indício textual não é confirmação do cliente.',
      'Ausência de evidência não prova falta de execução.',
      'Não atribuir score global de compliance sem acesso a todas as fontes e regras homologadas.',
      'Tarefa concluída, chamada curta ou atividade registrada não provam conexão.'],
    contextoIa:{etapa:etapa.agente,status:situacao,confianca:conf,
      indicadores:{tarefas:tarefas.length,ligacoesComEvidencia:chamadasComEvidencia.length,
        anotacoes:anotacoes.length,tarefasVencidas:vencidas.length},
      recomendacoes:recomendacoes.slice(0,3).map(x=>({acao:x.acao,porQue:x.porQue}))}
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
  return String(texto || '')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[LINK_OMITIDO]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[EMAIL_OMITIDO]')
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, '[DOCUMENTO_OMITIDO]')
    .replace(/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g, '[DOCUMENTO_OMITIDO]')
    .replace(/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g, '[TELEFONE_OMITIDO]')
    .replace(/\b\d{10,14}\b/g, '[NUMERO_OMITIDO]')
    .slice(0,900);
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
