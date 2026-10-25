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
  const ats = Array.isArray(leitura.atividades) ? leitura.atividades : [];
  const ts = Array.isArray(leitura.tarefas) ? leitura.tarefas : [];
  const calls = Array.isArray(leitura.ligacoesBoard) ? leitura.ligacoesBoard : [];
  const txt = ats.filter(a => a.textoDisponivel).map(a => ({data:a.data,fonte:a.tipo,texto:viWidgetSanitizar_(a.texto)})).filter(a=>a.texto);
  const corpus = txt.map(x=>x.texto).join('\n').toLowerCase();
  const has = re => re.test(corpus);
  const concorrente=has(/\b(outra empresa|concorrente|j[aá] resolvi|contratamos|contratei)\b/i);
  const cancelou=has(/\b(desmarc|cancel|reagend|n[aã]o poder)\b/i);
  const respondeu=has(/\b(obrigad|j[aá]|sim|n[aã]o|resolvi|empresa|contrat)/i);
  const campo=re=>{const x=corpus.match(re);return x?x[0].slice(0,150):'';};
  const lmv=campo(/(?:faturamento|receita|fatura)[^\n]{0,80}/i);
  const dor=campo(/(?:dor|problema|dificuldade|precisa|busca|objetivo)[^\n]{0,100}/i);
  const sistema=campo(/(?:sistema atual|erp|software|usa(?:m)?)[^\n]{0,80}/i);
  const decisor=campo(/(?:s[oó]cio|decisor|respons[aá]vel|diretor|propriet[aá]rio)[^\n]{0,80}/i);
  const pitch=has(/\b(apresent|demonstra|mostrei|solu[cç][aã]o|como funcion)/i);
  const nomeEtapa=String((leitura.negociacao||{}).etapaAtualNome||(leitura.negociacao||{}).etapaAtualId||'Etapa não identificada');
  const normal=nomeEtapa.normalize?nomeEtapa.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase():nomeEtapa.toLowerCase();
  const rota=[[/lead|entrada|novo/,0,'LEAD'],[/cadenc/,1,'CADÊNCIA'],[/identific|interesse|conex/,2,'CONEXÃO'],[/agenda|agend/,3,'AGENDA'],[/reuniao|reuni/,4,'REUNIÃO / CLOSER'],[/proposta|follow|recovery|recuper/,5,'FOLLOW-UP / RECOVERY']];
  const e=rota.filter(x=>x[0].test(normal))[0]||rota[2];
  const lote={};ts.filter(t=>t.concluida&&t.concluidaEm).forEach(t=>{const k=String(t.concluidaEm).slice(0,16);lote[k]=(lote[k]||0)+1;});
  const tarefasEmLote=Object.keys(lote).some(k=>lote[k]>=3);
  const callsOk=calls.filter(c=>Number(c.duracaoSegundos)>0||c.temReferenciaGravacao).length;
  const naoAtendeu=txt.filter(x=>/\bn[aã]o atendeu|sem resposta\b/i.test(x.texto)).length;
  const check=(titulo,ok,detalhe)=>({titulo:titulo,status:ok?'OK':'PENDENTE',detalhe:detalhe});
  const plano=concorrente?{
    status:'ATENÇÃO · NEGATIVA POR CONCORRENTE',
    acao:'Faça uma única tentativa contextual para entender se a solução escolhida cobre a dor original.',
    mensagem:'Entendi que vocês resolveram com outra empresa e não quero insistir sem sentido. A solução escolhida já cobre totalmente o ponto que motivou seu contato? Se houver algo em aberto, posso mostrar em 10 minutos como tratamos isso. Se estiver resolvido, organizo um retorno futuro sem te incomodar agora.',
    regra:'Se houver abertura, validar qualificação antes de agendar. Sem abertura ou sem resposta após essa tentativa, registrar perda por concorrente ou pausa controlada.'
  }:cancelou?{
    status:'ATENÇÃO · REUNIÃO/AGENDA EM RISCO',acao:'Confirmar novo horário e registrar o motivo do reagendamento antes de retomar cadência.',
    mensagem:'Vi que a reunião precisou ser ajustada. Qual período funciona melhor para retomarmos, e existe algo que eu possa preparar para tornar a conversa mais objetiva?',
    regra:'Sem novo horário confirmado, não considerar reunião como agendada nem avançar a etapa.'
  }:respondeu&&!lmv?{
    status:'ATENÇÃO · QUALIFICAÇÃO INCOMPLETA',acao:'Concluir LMV, dor, sistema atual e decisor antes de sugerir agenda.',
    mensagem:'Para eu entender se faz sentido avançar: qual é o faturamento médio mensal, como vocês resolvem isso hoje e qual impacto esse ponto tem na operação?',
    regra:'Não avançar para Agenda sem LMV e pitch evidenciados.'
  }:{status:'EM ANDAMENTO · PRÓXIMA AÇÃO DE ETAPA',acao:'Executar a próxima ação prevista para a etapa atual, registrando canal e resultado.',mensagem:'',regra:'Reavaliar quando houver nova evidência comercial ou mudança de etapa.'};
  const comp=[
    check('Entrada e cadência inicial',ats.length>0||ts.length>0,(ats.length||ts.length)?'Há atividade registrada.':'Sem atividade recuperada.'),
    check('Tentativa de contato comprovada',callsOk>0||respondeu,respondeu?'Resposta do lead registrada.':callsOk?'Ligação com evidência.':'Não comprovada.'),
    check('Agenda liberada',pitch&&Boolean(lmv),pitch&&lmv?'Pitch e LMV evidenciados.':'Exige pitch e LMV confirmados.'),
    check('Registro confiável de tarefas',!tarefasEmLote,tarefasEmLote?'Conclusões em lote não contam como tentativas comprovadas.':'Sem padrão de lote relevante.')
  ];
  const qual=[check('LMV validado pelo SDR',Boolean(lmv),lmv||'Não confirmado em conversa.'),check('Dor ou objetivo identificado',Boolean(dor),dor||'Sem evidência textual.'),check('Sistema atual mapeado',Boolean(sistema),sistema||'Sem evidência textual.'),check('Decisor identificado',Boolean(decisor),decisor||'Sem evidência textual.')];
  const resumo=[];if(concorrente)resumo.push('Lead informou que resolveu com outra empresa.');if(cancelou)resumo.push('Há sinal de cancelamento ou reagendamento.');if(naoAtendeu)resumo.push(naoAtendeu+' registro(s) de não atendimento — não equivalem a conexão.');if(tarefasEmLote)resumo.push('Tarefas concluídas em lote foram excluídas da contagem de tentativas.');if(!resumo.length)resumo.push('Sem exceção crítica identificada nas evidências recuperadas.');
  return {versao:VOLUM_WIDGET.versao,modo:'SOMENTE_LEITURA_CONSULTIVO',dealId:leitura.dealId,negociacao:{nome:String((leitura.negociacao||{}).nome||''),etapaAtualId:String((leitura.negociacao||{}).etapaAtualId||''),etapaAtualNome:nomeEtapa},agenteAtual:e[2],agentesExecutados:[viWidgetAgenteLead_(leitura),viWidgetAgenteCadencia_(leitura,txt),viWidgetAgenteConexao_(respondeu,Boolean(lmv),concorrente,e[1]>=3)],agentesNaoAplicaveis:['LEAD','CADÊNCIA','CONEXÃO','AGENDA','REUNIÃO / CLOSER','FOLLOW-UP / RECOVERY'].slice(e[1]+1),status:plano.status,risco:concorrente||cancelou?'ALTO':!lmv?'MÉDIO':'BAIXO',confianca:txt.length?'MÉDIA':'BAIXA',resumoExecutivo:resumo,plano:plano,proximaAcao:plano.acao,mensagemSugerida:plano.mensagem,regraDeDecisao:plano.regra,compliance:comp,qualificacao:qual,evidenciasResumo:{atividades:ats.length,ligacoesComprovadas:callsOk,registrosNaoAtendeu:naoAtendeu,tarefasEmLote:tarefasEmLote},bloqueiosDeAvanco:comp.filter(x=>x.status==='PENDENTE').map(x=>x.titulo),evidencias:txt.filter(x=>/\b(n[aã]o atendeu|desmarc|cancel|reagend|outra empresa|j[aá] resolvi|contrat)/i.test(x.texto)).slice(-8).reverse(),limites:['Ausência de evidência não prova ausência de execução.','Tarefas concluídas em lote não comprovam tentativa individual.'],contextoIa:txt.slice(-12)};
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
