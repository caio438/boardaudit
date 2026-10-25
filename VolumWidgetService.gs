/**
 * VOLUM Intelligence — núcleo consultivo para a widget privada do RD.
 * Sem endpoint HTTP e sem escrita no RD. A extensão futura só entrega o dealId.
 *
 * Pré-requisito: VolumIntelligenceLead.gs e ConsumoIA.gs carregados no mesmo projeto.
 */
// 0.4.6: evidências de e-mail, arquivos e recovery são avaliadas somente por fonte rastreável.
const VOLUM_WIDGET = Object.freeze({
  emailsAutorizados: ['crm@govolum.com', 'caio@govolum.com'],
  versao: '0.4.7'
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
  const parecer = viWidgetAdicionarEvidenciasBoard_(viWidgetRefinarParecerV4_(viWidgetParecerDeterministico_(leitura), leitura), leitura);
  parecer.playbookSalesOps=viWidgetPlaybookSalesOps_(leitura,parecer);
  parecer.auditoriaOperacional=viWidgetAuditoriaOperacional_(leitura);
  const usarGemini = Boolean(opcoes && opcoes.usarGemini === true);
  if (usarGemini && parecer.contextoIa && parecer.contextoIa.recomendacoes.length) {
    try {
      parecer.interpretacao = viWidgetInterpretarGemini_(parecer.contextoIa, dealId);
    } catch (e) {
      parecer.interpretacao = {disponivel:false,motivo:'IA_INDISPONIVEL'};
    }
  }
  delete parecer.contextoIa;
  return parecer;
}



// Estados por evidencia: enunciado do vendedor nao equivale a confirmacao de recebimento.
function viWidgetRecebimentoConfirmado_(texto) {
  const t=viWidgetNormalizar_(texto);
  if (/nao\s+(?:receb|chegou)|sem\s+(?:confirmacao|retorno)|(?:aguard|cobrar|confirmar|verificar|pedir).{0,45}receb/.test(t)) return false;
  return /(?:cliente|lead|comprador|contato).{0,65}(?:confirmou|acusou).{0,30}(?:recebimento|recebid)\w*|(?:cliente|lead|comprador|contato).{0,50}(?:disse|informou|respondeu).{0,25}(?:que\s+)?recebeu|(?:recebi|recebemos)\s+(?:a\s+)?(?:proposta|orcamento)/.test(t);
}
function viWidgetEhFollowup_(t) {
  return /(?:follow[ -]?up|recovery|retomad|retorno|cobrar resposta|pos[ -]?reuniao|proposta|acompanhar negociacao)/.test(viWidgetNormalizar_(String(t.assunto||'')+' '+String(t.anotacao||'')));
}
function viWidgetAuditoriaOperacional_(leitura) {
  const ats=Array.isArray(leitura.atividades)?leitura.atividades:[];
  const tarefas=Array.isArray(leitura.tarefas)?leitura.tarefas:[];
  const arquivos=Array.isArray(leitura.arquivosRd)?leitura.arquivosRd:[];
  const fontes=leitura.fontes||{};
  const reunioes=[...(leitura.reunioesCalendarioBoard||[]),...(leitura.reunioesBoard||[])];
  const aSort=ats.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  const email=aSort.find(a=>a.tipo==='email'&&/(?:formaliz|enviamos\s+(?:a\s+)?proposta|segue\s+(?:a\s+)?proposta)/.test(viWidgetNormalizar_(a.texto)));
  const link=aSort.find(a=>a.temLinkGravacao===true);
  const receb=aSort.find(a=>['note','response','messenger','whatsapp_transcription'].includes(a.tipo)&&viWidgetRecebimentoConfirmado_(a.texto));
  const pdf=arquivos.find(a=>String(a.extensao||'').toLowerCase()==='pdf'&&/(?:proposta|orcamento|comercial)/i.test(a.nome||''));
  const marco=[...reunioes.map(r=>r.data),...tarefas.filter(t=>t.tipo==='meeting'||/reuniao/i.test(t.assunto||'')).map(t=>t.concluidaEm)]
    .filter(Boolean).sort().at(-1)||'';
  const follow=tarefas.filter(t=>viWidgetEhFollowup_(t)&&marco&&
    String(t.criadaEm||t.previstaPara||'')>marco)
    .sort((a,b)=>String(a.previstaPara||'').localeCompare(String(b.previstaPara||'')))[0];
  const item=(id,titulo,estado,evidencia,fonte,data,acao)=>({id,titulo,estado,evidencia,fonte,data,acao});
  const nao=(fonte)=>fonte&&fonte.acessivel===true&&fonte.completo===true?'NAO_LOCALIZADO':'FONTE_INCOMPLETA';
  const resultado=[
    item('email','E-mail de formalizacao',email?'INDICIO':nao(fontes.atividades),
      email?'Mensagem associada ao envio ou formalizacao; entrega nao comprovada.':'Nao ha mensagem comprovada nas fontes acessiveis.',
      'RD · atividades/e-mail',email?.data||'','Confirmar destinatario, anexo e data de envio.'),
    item('gravacao','Link de gravacao',link?'INDICIO':nao(fontes.atividades),
      link?'Referencia de URL de gravacao localizada, endereco omitido por seguranca.':'Link nao localizado no historico consultado.',
      'RD · atividades',link?.data||'','Verificar se abre a gravacao correta e auditar o conteudo.'),
    item('proposta','PDF de proposta',pdf?'INDICIO':nao(fontes.arquivosRd),
      pdf?'Arquivo compativel: '+viWidgetSanitizar_(pdf.nome):'Nao foi possivel confirmar PDF de proposta.',
      'RD · arquivos',pdf?.data||'','Validar PDF, versao, valor e destinatario.'),
    item('recebimento','Confirmacao de recebimento',receb?'INDICIO':nao(fontes.atividades),
      receb?'Registro descreve confirmacao explicita de recebimento; autoria requer conferencia.':'Texto inequivoco de confirmacao nao encontrado.',
      'RD · anotacoes/WhatsApp',receb?.data||'','Conferir quem confirmou e quando.'),
    item('followup','Tarefa de follow-up apos reuniao',follow?'INDICIO':(!marco?'MARCO_REUNIAO_NAO_VERIFICADO':nao(fontes.tarefas)),
      follow?'Tarefa posterior localizada: '+viWidgetSanitizar_(follow.assunto)+'; prevista para '+viWidgetDiaExibicao_(viWidgetDiaBrasil_(follow.previstaPara)):!marco?'Data da reuniao nao confirmada; impossivel avaliar posteridade.':'Tarefa posterior nao identificada.',
      'RD · tarefas/reunioes',follow?.criadaEm||'','Registrar proximo passo e validar resultado com o comprador.')
  ];
  return {criterios:resultado,cobertura:{atividades:fontes.atividades||{},tarefas:fontes.tarefas||{},arquivos:fontes.arquivosRd||{}},
    observacao:'INDICIO = registro rastreavel; NAO_LOCALIZADO nao comprova ausencia de execucao.'};
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
  const arquivosRd = Array.isArray(leitura.arquivosRd) ? leitura.arquivosRd : [];
  const fontes = leitura.fontes || {};
  const fonteAtividades = fontes.atividades || {};
  const fonteTarefas = fontes.tarefas || {};
  const nomeEtapa = String((leitura.negociacao || {}).etapaAtualNome || '');
  const etapa = viWidgetEtapa_(nomeEtapa);
  const faseCloser = etapa.indice >= 4 && etapa.indice <= 5;
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
  const referenciasReuniao = (Array.isArray(leitura.reunioesCalendarioBoard)?leitura.reunioesCalendarioBoard:[])
    .map(x=>Date.parse(x.data||'')).filter(Number.isFinite)
    .concat(tarefaDeReuniao.map(x=>Date.parse(x.concluidaEm||x.previstaPara||'')).filter(Number.isFinite));
  const ultimaReuniaoMs = referenciasReuniao.length ? Math.max.apply(null,referenciasReuniao) : null;
  const tarefasFollowup = comPrazo.filter(x => viWidgetEhFollowup_(x) && ultimaReuniaoMs!==null && Date.parse(x.criadaEm||x.previstaPara)>ultimaReuniaoMs);
  const textosEmailOuWhatsApp = ats.filter(x=>['email','messenger','whatsapp_audio','whatsapp_transcription','response','note'].includes(String(x.tipo||'').toLowerCase())&&x.textoDisponivel).map(x=>viWidgetNormalizar_(x.texto)).join('\n');
  const gravacaoReferenciada = ats.some(x=>Boolean(x.temLinkGravacao)) || /(?:gravac|recording|tldv|grain|fireflies|fathom|loom|zoom\.us|link\s+da\s+reuniao\s+(?:que\s+)?fizemos)/.test(textosEmailOuWhatsApp);
  const recebimentoConfirmado = ats.some(x=>x&&x.textoDisponivel&&['note','response','messenger','whatsapp_transcription'].includes(String(x.tipo||''))&&viWidgetRecebimentoConfirmado_(x.texto));
  const propostaPdf = arquivosRd.filter(x=>String(x.extensao||'').toLowerCase()==='pdf'&&/(?:proposta|orcamento|apresentacao|comercial)/i.test(String(x.nome||'')));
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
    criterio('Link da gravação da reunião',gravacaoReferenciada?'INDICIO':'NAO_VERIFICAVEL',gravacaoReferenciada?'Há referência contextual de gravação em e-mail/anotação; validar acesso, reunião e conteúdo.':'Nenhum link de gravação foi identificado em e-mail ou anotação acessível.','RD · e-mail / anotações'),
    criterio('Anotação privada do vendedor',ats.some(x=>x.tipo==='note' && x.textoDisponivel)?'INDICIO':'NAO_VERIFICAVEL',
      ats.some(x=>x.tipo==='note' && x.textoDisponivel)?'Há anotação RD, mas não é possível confirmar se é a anotação privada de reunião.':'O tipo e a privacidade da anotação de reunião não estão confirmados.','Plano Wisetec · closer'),
    criterio('Proposta comercial anexada em PDF',propostaPdf.length?'INDICIO':'NAO_VERIFICAVEL',propostaPdf.length?'Há '+propostaPdf.length+' PDF(s) com nome compatível com proposta; validar conteúdo, envio e versão.':'Nenhum PDF com nome compatível foi identificado nos arquivos acessíveis.','RD · arquivos'),
    criterio('Tarefa de follow-up/recovery após reunião',tarefasFollowup.length?'INDICIO':'NAO_VERIFICAVEL',
       tarefasFollowup.length?'Há '+tarefasFollowup.length+' tarefa(s) de follow-up/recovery datada(s) após a reunião conhecida. O acordo com o lead não está comprovado.':'Nenhuma tarefa posterior de follow-up/recovery foi identificada com os dados disponíveis.','RD · tarefas / reuniões'),
    criterio('Valores da proposta','NAO_VERIFICAVEL','Valor e coerência da proposta não estão disponíveis nesta coleta.','Plano Wisetec · closer'),
    criterio('Confirmação de recebimento da proposta',recebimentoConfirmado?'INDICIO':'NAO_VERIFICAVEL',recebimentoConfirmado?'Há texto com sinal de confirmação de recebimento em e-mail/WhatsApp; validar autoria e contexto.':'Nenhuma confirmação explícita de recebimento foi identificada em e-mail ou WhatsApp acessível.','RD · e-mail / WhatsApp'),
    criterio('Cadência de follow-up do closer',tarefasFollowup.length?'INDICIO':'NAO_VERIFICAVEL',
       tarefasFollowup.length?'Há follow-up/recovery posterior à reunião; não há régua homologada para afirmar aderência.':'A sequência de follow-up depende de régua e histórico completos.','RD · tarefas / reuniões')
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

  const inteligencia = viWidgetInteligenciaComercial_(leitura);
  const planoSdr = viWidgetPlanoSdr_(leitura);
  const alertasSdr = planoSdr.itens.filter(x=>x.status==='ATENCAO');
  const novoAlertaSdr = alertasSdr.find(x=>x.id!=='tarefas');
  if(novoAlertaSdr) recomendar('ALTA','SDR · '+novoAlertaSdr.acao,
    novoAlertaSdr.detalhe,'Resultado de acompanhamento e evidencia registrados.',
    'Plano SDR Wisetec');
  if(alertasSdr.length) {
    resumo.push('Plano SDR: '+alertasSdr.length+' situacao(oes) exigem revisao de evidencias.');
  }
  // Acrescentar no maximo 2 alertas comerciais com fonte, sem criar acoes duplicadas.
  const focos = inteligencia.itens.filter(x => x.status==='ATENCAO' &&
    x.prioridade==='ALTA' && x.id!=='vencidas');
  focos.slice(0,2).forEach(x=>recomendar('ALTA',x.acao,
    x.detalhe,'Confirmar no CRM o resultado e a evidencia correspondente.',x.fonte));
  if(inteligencia.contagem.ATENCAO>0) {
    resumo.push(inteligencia.contagem.ATENCAO+' sinal(is) de atencao a revisar; nao representam falhas comprovadas.');
  }
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
    agenteAtual:etapa.agente,etapaOrigem:String((leitura.negociacao || {}).etapaOrigem || 'NAO_CONFIRMADA'),agentesExecutados:agentes,
    agentesNaoAplicaveis:etapa.indice >= 0 ? eixos.slice(Math.min(etapa.indice+1,eixos.length)) : [],
    status:situacao, risco:risco, confianca:conf,notaCompliance:null,
    resumoExecutivo:resumo, proximaAcao:principal.acao,
    regraDeDecisao:principal.criterioConclusao,
    mensagemSugerida:mensagem, plano:{status:situacao,acao:principal.acao,mensagem:mensagem,regra:principal.criterioConclusao},
    recomendacoes:recomendacoes.slice(0,6),inteligenciaComercial:inteligencia,planoOtimizacaoSdr:planoSdr,compliance:compliance,
    qualificacao:qual, criteriosPlanoWisetec:faseCloser?criterioCloser:[],
    fontesCobertura:[
      criterio('Atividades RD',fonteAtividades.acessivel === true?(fonteAtividades.completo === true?'CONSULTADA':'PARCIAL'):'NAO_VERIFICAVEL',
        fonteAtividades.acessivel === true?'Consulta de atividades '+(fonteAtividades.completo === true?'completa':'incompleta')+'.':'Consulta não confirmada.'),
      criterio('Tarefas RD',fonteTarefas.acessivel === true?(fonteTarefas.completo === true?'CONSULTADA':'PARCIAL'):'NAO_VERIFICAVEL',
        fonteTarefas.acessivel === true?'Consulta de tarefas '+(fonteTarefas.completo === true?'completa':'incompleta')+'.':'Consulta não confirmada.'),
      criterio('Ligações board','CONSULTADA','Vínculos por ID de negociação; ligação não comprova conversa.'),
      criterio('E-mails RD',ats.filter(x=>String(x.tipo||'').toLowerCase()==='email').length?'CONSULTADA':'NAO_VERIFICAVEL',
        ats.filter(x=>String(x.tipo||'').toLowerCase()==='email').length?'Atividades de e-mail foram consultadas; envio não equivale a recebimento.':'Nenhuma atividade de e-mail disponível nesta leitura.'),
      criterio('Propostas PDF e gravação de reunião','NAO_VERIFICAVEL','Anexos e conteúdo de gravação não são coletados automaticamente.')
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


/**
 * Checklist consultivo de inteligencia comercial. Todos os itens sao
 * sinais/indicios, nao a avaliacao de performance do vendedor.
 * Fontes indisponiveis => NAO_VERIFICAVEL; anotacoes => INDICIO.
 * Nao escrever no CRM e nao aplicar SLA de cliente nao homologado.
 */
function viWidgetInteligenciaComercial_(leitura) {
  const negociacao = leitura.negociacao || {};
  const fontes = leitura.fontes || {};
  const atividades = Array.isArray(leitura.atividades) ? leitura.atividades : [];
  const tarefas = Array.isArray(leitura.tarefas) ? leitura.tarefas : [];
  const ligacoes = Array.isArray(leitura.ligacoesBoard) ? leitura.ligacoesBoard : [];
  const eventos = Array.isArray(leitura.eventos) ? leitura.eventos : [];
  const etapa = viWidgetEtapa_(negociacao.etapaAtualNome || '');
  const closer = etapa.indice === 4 || etapa.indice === 5;
  const encerrar = etapa.indice === 6 || negociacao.estadoFechamento === 'GANHA' ||
    negociacao.estadoFechamento === 'PERDIDA';
  const atividadesCompletas = fontes.atividades && fontes.atividades.acessivel === true &&
    fontes.atividades.completo === true;
  const tarefasCompletas = fontes.tarefas && fontes.tarefas.acessivel === true &&
    fontes.tarefas.completo === true;
  const naoEncontrado = atividadesCompletas ? 'SEM_EVIDENCIA' : 'NAO_VERIFICAVEL';
  const semTarefa = tarefasCompletas ? 'SEM_EVIDENCIA' : 'NAO_VERIFICAVEL';
  const notas = atividades.filter(a => a && a.textoDisponivel &&
    ['note','response','messenger','whatsapp_transcription','email'].includes(String(a.tipo || '').toLowerCase()))
    .map(a => ({data:String(a.data || ''),fonte:String(a.tipo || 'RD'),
      texto:viWidgetSanitizar_(a.texto || '')}))
    .filter(a => a.texto).sort((a,b) => a.data.localeCompare(b.data));
  const procura = regex => {
    for (let i = notas.length-1; i >= 0; i--) {
      if (regex.test(viWidgetNormalizar_(notas[i].texto))) return notas[i];
    }
    return null;
  };
  const campo = regex => {
    for(let i = notas.length-1; i>=0; i--){
      const m=viWidgetNormalizar_(notas[i].texto).match(regex);
      if(m && m[1] && m[1].trim()) return notas[i];
    }
    return null;
  };
  const evidencia = nota => nota ? ('Anotacao de ' +
    (nota.data ? nota.data.slice(0,10) : 'data nao informada') +
    ': ' + nota.texto.slice(0,120)) : '';
  const itens = [];
  function adiciona(id,grupo,titulo,status,detalhe,acao,fonte,prioridade,prova) {
    itens.push({
      id:id, grupo:grupo, titulo:titulo, status:status, detalhe:detalhe,
      acao:acao || '', fonte:fonte || 'RD Station / BoardAudit',
      prioridade:prioridade || 'BAIXA', evidencia:prova || '',
      interpretacao:'Ausencia de registro nao comprova ausencia de acao.'
    });
  }
  const dor = campo(/(?:^|[\n;.])\s*(?:dor|problema|desafio|objetivo)\s*[:=-]\s*([^\n;.]{3,})/);
  const impacto = procura(/(?:perda de|perdemos|reduzir custos|economia|prejuizo|desperdicio|horas por|custo mensal|impacto financeiro|ganho de produtividade)/);
  const fit = campo(/(?:^|[\n;.])\s*(?:segmento|setor|perfil da empresa|porte|tipo de empresa)\s*[:=-]\s*([^\n;.]{3,})/);
  const kpi = campo(/(?:^|[\n;.])\s*(?:meta|kpi|indicador de sucesso|resultado esperado|resultado desejado)\s*[:=-]\s*([^\n;.]{3,})/);
  const lmv = campo(/(?:^|[\n;.])\s*(?:lmv|faturamento mensal|receita mensal|orcamento|budget)\s*[:=-]\s*([^\n;.]{3,})/);
  const decisor = campo(/(?:^|[\n;.])\s*(?:decisor|tomador de decisao|responsavel pela decisao)\s*[:=-]\s*([^\n;.]{3,})/);
  const stakeholder = campo(/(?:^|[\n;.])\s*(?:envolvidos|participantes da decisao|influenciadores|outros decisores)\s*[:=-]\s*([^\n;.]{3,})/);
  const urgencia = campo(/(?:^|[\n;.])\s*(?:prazo de decisao|prazo para contratar|quando precisa|data de implantacao|urgencia)\s*[:=-]\s*([^\n;.]{3,})/);
  const criterioCompra = campo(/(?:^|[\n;.])\s*(?:criterios de escolha|criterio de compra|requisitos chave|requisitos principais)\s*[:=-]\s*([^\n;.]{3,})/);
  const objecao = procura(/(?:objecao|muito caro|preco alto|sem orcamento|vai pensar|precisa pensar|concorrente mais barato)/);
  const contorno = procura(/(?:contornamos a objecao|tratamos a objecao|esclarecemos|validamos a objecao|respondemos a objecao)/);
  const concorrente = procura(/(?:fechou|contratou|optou|escolheu)\s+(?:com\s+|por\s+)?(?:outra empresa|concorrente|outro fornecedor)|(?:resolveu|fechou)\s+com\s+(?:um\s+)?concorrente/);
  const concorrencia = procura(/(?:concorrente|outro fornecedor|outra empresa|outras propostas)/);
  const recebimento = procura(/(?:cliente|lead|prospect)\s+(?:confirmou|acusou)\s+(?:o\s+)?recebimento\s+(?:da\s+)?proposta|proposta\s+recebida\s+e\s+confirmada/);
  const conversa = procura(/(?:cliente|lead|prospect)\s+(?:respondeu|retornou|confirmou|conversou|falou)\b|(?:falamos|conversamos)\s+com\s+(?:o\s+|a\s+)?(?:cliente|lead|prospect)/);
  const conversaNegada = conversa && /(?:nao respondeu|nao retornou|nao confirmou|sem retorno)/.test(viWidgetNormalizar_(conversa.texto));
  const propostas = atividades.filter(a=>a.tipo==='proposal');
  const propostaTexto=procura(/(?:proposta\s+(?:foi\s+)?enviada|enviamos\s+(?:a\s+)?proposta|orcamento\s+enviado)/);
  const tarefasAbertas = tarefas.filter(t=>!t.concluida);
  const tarefasComData = tarefasAbertas.filter(t=>t.previstaPara && Number.isFinite(Date.parse(t.previstaPara)));
  const vencidas = tarefasComData.filter(t=>Date.parse(t.previstaPara)<Date.now());
  const reunioes = tarefas.filter(t=>t.tipo==='meeting'||/reuniao|apresentacao|demonstracao/i.test(t.assunto||''));
  const tarefasEmLote = {};
  tarefas.filter(t=>t.concluida&&t.concluidaEm).forEach(t=>{
    const k=String(t.concluidaEm).slice(0,16);
    tarefasEmLote[k]=(tarefasEmLote[k]||0)+1;
  });
  const temLote = Object.keys(tarefasEmLote).some(k=>tarefasEmLote[k]>=3);
  const evidenciasDatadas = eventos.filter(x=>x.data && x.tipo!=='ENTRADA_ETAPA' &&
    Number.isFinite(Date.parse(x.data))).map(x=>x.data);
  const ultima = evidenciasDatadas.sort().slice(-1)[0] || '';
  const diasSemMovimento = ultima ? Math.max(0,Math.floor((Date.now()-Date.parse(ultima))/86400000)) : null;
  const dataFechamento = negociacao.previsaoFechamento &&
    Number.isFinite(Date.parse(negociacao.previsaoFechamento)) ?
      Date.parse(negociacao.previsaoFechamento) : null;
  const valor = Number(negociacao.valorInformado);
  const temValor = negociacao.valorInformado !== null &&
    negociacao.valorInformado !== undefined && Number.isFinite(valor) && valor>0;
  const completo = Boolean(atividadesCompletas&&tarefasCompletas);
  const origem = String(negociacao.etapaOrigem || '');

  adiciona('etapa','Contexto e qualificacao','Etapa comercial mapeada',
    etapa.indice>=0&&origem!=='SEM_NOME'&&origem!=='FALHA_CONSULTA_ETAPA'?'EVIDENCIADO':'NAO_VERIFICAVEL',
    etapa.indice>=0?'O RD informa '+String(negociacao.etapaAtualNome||'')+'.':'Etapa ainda nao confirmada pela API.',
    'Confirmar etapa e funil correto antes de aplicar regras de passagem.','RD · negocio','MEDIA');
  adiciona('responsavel','Contexto e qualificacao','Responsavel identificado',
    negociacao.responsavel?'EVIDENCIADO':'SEM_EVIDENCIA',
    negociacao.responsavel?'Responsavel na negociacao: '+String(negociacao.responsavel).slice(0,80)+'.':'O campo de responsavel nao veio preenchido nesta leitura.',
    'Confirmar a responsabilidade por proximo passo e atualizacao do CRM.','RD · negocio','MEDIA');
  adiciona('perfil','Contexto e qualificacao','Perfil/segmento e aderencia ao ICP',
    fit?'INDICIO':naoEncontrado,fit?'Ha indicio de caracterizacao do perfil nas anotacoes.':'Segmento ou porte nao foi encontrado em campo textual reconhecivel.',
    'Conferir segmento, porte e aderencia ao perfil de cliente ideal.','Anotacoes RD','MEDIA',evidencia(fit));
  adiciona('dor','Contexto e qualificacao','Dor ou objetivo de negocio',
    dor?'INDICIO':naoEncontrado,dor?'Dor ou objetivo foi mencionado nas anotacoes.':'Dor explicita ainda nao foi localizada nas fontes textuais acessiveis.',
    'Registrar a necessidade principal em linguagem do cliente.','Anotacoes RD','ALTA',evidencia(dor));
  adiciona('impacto','Contexto e qualificacao','Impacto mensuravel da dor',
    impacto?'INDICIO':naoEncontrado,impacto?'Registro sugere impacto financeiro ou operacional; falta validar numeros.':'Nao foi encontrado custo, perda ou ganho descrito em termos verificaveis.',
    'Perguntar quanto custa manter o problema e qual melhoria seria considerada sucesso.','Anotacoes RD','MEDIA',evidencia(impacto));
  adiciona('kpi','Contexto e qualificacao','Resultado esperado e criterio de sucesso',
    kpi?'INDICIO':naoEncontrado,kpi?'Uma meta ou resultado foi mencionado.':'Meta de implantacao ou resultado esperado nao foi identificado.',
    'Definir com o lead um resultado desejado e como sera medido.','Anotacoes RD','MEDIA',evidencia(kpi));
  adiciona('lmv','Contexto e qualificacao','Capacidade de compra / LMV',
    lmv?'INDICIO':naoEncontrado,lmv?'Registro menciona faturamento ou orcamento, sem validacao externa.':'LMV ou faixa de investimento nao foi encontrada de forma explicita.',
    'Confirmar capacidade de investimento sem inferir pelo porte.','Anotacoes RD','MEDIA',evidencia(lmv));

  adiciona('decisor','Processo de decisao','Decisor economico identificado',
    decisor?'INDICIO':naoEncontrado,decisor?'Anotacoes apontam um responsavel pela decisao.':'Nao foi identificado o decisor na leitura textual.',
    'Confirmar quem aprova a compra e quem participa da decisao.','Anotacoes RD','ALTA',evidencia(decisor));
  adiciona('influenciadores','Processo de decisao','Outros influenciadores e envolvidos',
    stakeholder?'INDICIO':naoEncontrado,stakeholder?'Ha indicio dos demais envolvidos.':'Influenciadores ou equipes envolvidas nao foram identificados.',
    'Mapear aprovadores tecnicos, financeiros e usuarios impactados.','Anotacoes RD','MEDIA',evidencia(stakeholder));
  adiciona('tempo','Processo de decisao','Momento de compra e prazo de decisao',
    urgencia?'INDICIO':naoEncontrado,urgencia?'Prazo mencionado nas anotacoes; ainda nao representa compromisso confirmado.':'Prazo do projeto ou gatilho de urgencia nao foi registrado explicitamente.',
    'Validar por que resolver agora e qual evento determina o prazo.','Anotacoes RD','MEDIA',evidencia(urgencia));
  adiciona('criterios','Processo de decisao','Criterios de avaliacao da solucao',
    criterioCompra?'INDICIO':naoEncontrado,criterioCompra?'Criterios de escolha citados nas notas.':'Criterios para comparar alternativas nao foram identificados.',
    'Perguntar quais tres fatores definirao a escolha final.','Anotacoes RD','MEDIA',evidencia(criterioCompra));
  adiciona('concorrentes','Processo de decisao','Concorrencia e decisao por fornecedor',
    concorrente?'ATENCAO':concorrencia?'INDICIO':naoEncontrado,
    concorrente?'Anotacao sugere escolha de outro fornecedor; validar se a negociacao foi encerrada.':
      concorrencia?'Alternativas foram mencionadas, mas nao se pode concluir uma perda.':
      'Nao foram encontradas mencoes explicitas; nao significa ausencia de concorrentes.',
    'Confirmar o contexto e os diferenciais relevantes sem criar perda automatica.','Anotacoes RD',
    concorrente?'ALTA':'BAIXA',evidencia(concorrente||concorrencia));
  adiciona('objecoes','Processo de decisao','Objecoes comerciais documentadas',
    objecao?'INDICIO':naoEncontrado,objecao?'Foi encontrada mencao de resistencia, preco ou necessidade de avaliar.':'Nao foi encontrada objecao explicita.',
    'Documentar a objecao real e investigar a causa antes de responder.','Anotacoes RD','MEDIA',evidencia(objecao));
  adiciona('tratamento','Processo de decisao','Resposta a objecao com proximo acordo',
    objecao?(contorno?'INDICIO':naoEncontrado):'NAO_APLICAVEL',
    objecao?(contorno?'Tratamento citado no registro; confirmar reacao do lead.':'Ha objecao anotada sem registro claro de tratamento ou acordo.'):'Sem objecao explicita nesta coleta.',
    'Vincular resposta a objecao e proximo passo aceito pelo cliente.','Anotacoes RD','MEDIA',evidencia(contorno));

  adiciona('proposta','Proposta e fechamento','Evidencia de proposta enviada',
    propostas.length||propostaTexto?'INDICIO':closer?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    propostas.length||propostaTexto?'Existe atividade ou anotacao de proposta, mas o PDF e envio nao estao confirmados.':
      closer?'O estagio sozinho nao confirma que a proposta foi enviada.':'Proposta ainda nao e exigivel nesta etapa do funil.',
    'Verificar documento, valores, destinatario e data do envio.','Atividades RD; anexos nao coletados','MEDIA',evidencia(propostaTexto));
  adiciona('recebimento','Proposta e fechamento','Recebimento da proposta confirmado',
    recebimento?'INDICIO':closer?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    recebimento?'Anotacao sugere confirmacao de recebimento.':'Sem prova do recebimento no canal; nao confundir envio com leitura.',
    'Confirmar recebimento e obter feedback objetivo sobre a proposta.','Anotacoes RD; e-mail nao validado','MEDIA',evidencia(recebimento));
  adiciona('valor','Proposta e fechamento','Valor informado na negociacao',
    temValor?'EVIDENCIADO':closer?'SEM_EVIDENCIA':'NAO_APLICAVEL',
    temValor?'O RD retornou um valor numerico positivo; nao comprova aceite do lead.':'Nao foi recuperado valor positivo da negociacao.',
    'Conferir valores do CRM com o documento comercial efetivamente aprovado.','RD · negocio','MEDIA');
  adiciona('previsao','Proposta e fechamento','Previsao de fechamento coerente',
    dataFechamento===null?(closer?'SEM_EVIDENCIA':'NAO_APLICAVEL'):
      !encerrar && dataFechamento < Date.now()-86400000?'ATENCAO':'INDICIO',
    dataFechamento===null?'Previsao de fechamento nao informada ou invalida.':
      !encerrar&&dataFechamento<Date.now()-86400000?
      'Data prevista passou e a negociacao continua aberta; isso nao e necessariamente uma falha comercial.':
      'Ha data de previsao no RD, mas a confiabilidade depende do acordo com o comprador.',
    'Revalidar prazo de fechamento com o lead e alinhar a expectativa do forecast.','RD · negocio','ALTA');
  adiciona('gravacao','Proposta e fechamento','Gravacao/pitch da reuniao do closer',
    closer?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    'A coleta atual nao acessa transcricao da reuniao do closer nem verifica execucao do pitch.',
    'Conferir gravacao, diagnostico, ancoragem, objecoes e fechamento na auditoria Closer.','Transcricao nao conectada','BAIXA');

  adiciona('retorno','Engajamento e cadencia','Resposta efetiva do lead',
    conversa&&!conversaNegada?'INDICIO':naoEncontrado,
    conversa&&!conversaNegada?'Anotacao sugere retorno ou conversa; nao substitui audio ou mensagem do cliente.':
      'Nao foi encontrada resposta inequívoca, mesmo havendo tarefas ou ligacoes.',
    'Reconciliar resultado da interacao com o canal de origem.','Anotacoes RD','MEDIA',evidencia(conversa&&!conversaNegada?conversa:null));
  adiciona('proximopasso','Engajamento e cadencia','Proxima acao com data',
    tarefasComData.length?'INDICIO':encerrar?'NAO_APLICAVEL':semTarefa,
    tarefasComData.length?'Existem '+tarefasComData.length+' tarefa(s) abertas com data; nao comprovam acordo com o lead.':
      'Nenhuma tarefa futura ou vencida com data foi recuperada.',
    'Definir com o responsavel a proxima acao, data, canal e resultado esperado.','Tarefas RD','ALTA');
  adiciona('vencidas','Engajamento e cadencia','Tarefas vencidas',
    vencidas.length?'ATENCAO':tarefasCompletas?'EVIDENCIADO':'NAO_VERIFICAVEL',
    vencidas.length?vencidas.length+' tarefa(s) abertas com data anterior ao momento da consulta.':
      'Nao foram observadas tarefas abertas vencidas na fonte consultada; nao prova cadencia completa.',
    'Conferir se a acao aconteceu antes de remarcar e documentar evidencia.','Tarefas RD',vencidas.length?'ALTA':'BAIXA');
  adiciona('inatividade','Engajamento e cadencia','Oportunidade sem movimentacao registrada',
    diasSemMovimento===null?'NAO_VERIFICAVEL':
      !encerrar&&diasSemMovimento>=14?'ATENCAO':'INDICIO',
    diasSemMovimento===null?'Nao foi possivel determinar a ultima movimentacao.':
      diasSemMovimento+' dia(s) desde o ultimo registro observavel. Marco de 14 dias e triagem, nao SLA aprovado.',
    'Confirmar se houve interacao nao registrada antes de definir retomada.','Linha do tempo RD + board',
    diasSemMovimento!==null&&diasSemMovimento>=14?'MEDIA':'BAIXA');
  adiciona('lote','Engajamento e cadencia','Confiabilidade das tentativas',
    temLote?'ATENCAO':'NAO_VERIFICAVEL',
    temLote?'Tres ou mais tarefas foram finalizadas no mesmo minuto; nao equivalem a contatos separados.':
      'Nao e possivel atestar a sequencia multicanal sem WhatsApp, e-mail e prova por canal.',
    'Reconciliar tarefas com audios, mensagens e cadencia oficial.','Tarefas RD e board',
    temLote?'MEDIA':'BAIXA');
  adiciona('reuniao','Engajamento e cadencia','Reuniao e continuidade registrada',
    reunioes.length?(tarefasComData.length?'INDICIO':'SEM_EVIDENCIA'):'NAO_VERIFICAVEL',
    reunioes.length?(tarefasComData.length?'Ha reuniao relacionada e tarefa datada, mas o acordo nao esta confirmado.':
      'Ha tarefa de reuniao, sem continuidade futura datada nesta leitura.'):'Reunioes feitas fora do RD podem nao estar nesta coleta.',
    'Validar resultado da reuniao e compromisso seguinte.','Tarefas RD','MEDIA');

  adiciona('cobertura','Governanca dos dados','Cobertura das fontes comerciais',
    completo?'EVIDENCIADO':'ATENCAO',
    completo?'Consultas RD de atividades e tarefas relatadas como completas; anexos e canais externos seguem fora.':
      'Atividades ou tarefas tem consulta parcial/falha. Conclusoes dependentes delas podem estar incompletas.',
    'Priorizar integracao de canais e verificacao de paginacao antes de concluir compliance.','Integracao RD','MEDIA');
  adiciona('tipagem','Governanca dos dados','Consistencia dos tipos de atividade',
    Number((fontes.atividades||{}).conflitosDeTipo||0)>0?'ATENCAO':
      atividadesCompletas?'INDICIO':'NAO_VERIFICAVEL',
    Number((fontes.atividades||{}).conflitosDeTipo||0)>0?
      'Foram detectadas atividades classificadas em mais de um tipo.':
      'Sem divergencias detectadas nesta consulta, mas a origem pode ter sido inferida pelo filtro.',
    'Revisar conflitos antes de somar tentativas ou comparar etapas.','RD · origem da tipagem','MEDIA');

  const total=itens.length;
  const contagem={ATENCAO:0,INDICIO:0,EVIDENCIADO:0,SEM_EVIDENCIA:0,NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
  itens.forEach(x=>{contagem[x.status]=(contagem[x.status]||0)+1;});
  return {
    versao:'1.0', total:total, contagem:contagem,
    areas:['Contexto e qualificacao','Processo de decisao','Proposta e fechamento',
      'Engajamento e cadencia','Governanca dos dados'],
    itens:itens, ultimaMovimentacao:ultima, diasSemMovimento:diasSemMovimento,
    coberturaCompleta:completo, emEtapaCloser:closer,
    aviso:'Leitura consultiva: indicio textual nao equivale a fato confirmado. Ausencia de registro nao comprova falta de execucao. Nao ha nota automatica de compliance.'
  };
}


/**
 * Plano de Otimizacao SDR - Wisetec.
 * Referencia: auditoria do plano SDR de 14/09/2026 (sete pilares).
 * Complementos consultivos nao substituem a escuta da ligacao ou a regra homologada.
 * Retorna evidencias e acoes por criterio sem pontuacao automatica.
 */
function viWidgetPlanoSdr_(leitura) {
  const notas = (Array.isArray(leitura.atividades)?leitura.atividades:[])
    .filter(x=>x&&x.textoDisponivel&&['note','response','messenger','whatsapp_transcription'].includes(String(x.tipo||'').toLowerCase()))
    .map(x=>({data:String(x.data||''),texto:viWidgetSanitizar_(x.texto||'')}))
    .sort((a,b)=>a.data.localeCompare(b.data));
  const tarefas = Array.isArray(leitura.tarefas)?leitura.tarefas:[];
  const chamadas = Array.isArray(leitura.ligacoesBoard)?leitura.ligacoesBoard:[];
  const fontes = leitura.fontes||{};
  const coberturaTarefa=(fontes.tarefas||{}).acessivel===true&&(fontes.tarefas||{}).completo===true;
  const coberturaAtiv=(fontes.atividades||{}).acessivel===true&&(fontes.atividades||{}).completo===true;
  const cT=coberturaTarefa?'SEM_EVIDENCIA':'NAO_VERIFICAVEL';
  const cA=coberturaAtiv?'SEM_EVIDENCIA':'NAO_VERIFICAVEL';
  const normal = x=>viWidgetNormalizar_(x);
  const nota=regex=>notas.filter(n=>regex.test(normal(n.texto))).slice(-1)[0]||null;
  const detalhe=n=>n?'Anotacao '+(n.data?n.data.slice(0,10):'sem data')+
    ': '+n.texto.slice(0,125):'';
  const dias=Array.from(new Set(chamadas.map(x=>String(x.data||'').slice(0,10)).filter(Boolean))).sort();
  const registrosCadencia=tarefas.filter(t=>/(?:cadencia|cadência|recovery|retomada|dia\s*\d+|tentativa\s*\d+)/i.test(t.assunto||''));
  const voip=chamadas.filter(x=>x.temReferenciaGravacao||Number(x.duracaoSegundos)>0);
  const conversa=nota(/(?:conversamos|falamos)\s+com\s+(?:o\s+|a\s+)?(?:cliente|lead)|(?:cliente|lead)\s+(?:retornou|confirmou|respondeu)/);
  const naoAtendeu=nota(/(?:nao atendeu|sem resposta|caixa postal|nao respondeu)/);
  const noShow=nota(/(?:no[\s-]?show|nao compareceu|faltou a reuniao|nao entrou na reuniao)/);
  const tarefaNoShow=tarefas.filter(t=>/(?:no[\s-]?show|reagend|retomada)/i.test(t.assunto||''));
  const planoNoShow=noShow||tarefaNoShow.length>0;
  const followNoShow=tarefaNoShow.some(t=>{
    if(!noShow||!noShow.data)return true;
    const data=t.criadaEm||t.previstaPara||'';
    return data&&data>=noShow.data;
  });
  const encontro=tarefas.filter(t=>t.tipo==='meeting'||/reuniao|apresentacao|demo/i.test(t.assunto||''));
  const encontroComData=encontro.filter(t=>t.previstaPara&&Number.isFinite(Date.parse(t.previstaPara)));
  const envioConvite=nota(/(?:convite enviado|link da reuniao enviado|reuniao confirmada|confirmou a reuniao)/);
  const passagem=nota(/(?:passagem de bastao|passado para o closer|closer responsavel|o closer vai|encaminhado ao closer)/);
  const passo=nota(/(?:proximo passo|combinamos|ficou combinado|vamos retornar|retorno agendado)/);
  const segmento=nota(/(?:^|[\n;.])\s*(?:segmento|setor|atividade|ramo|tipo de empresa)\s*[:=-]\s*[^\n;]{2,}/);
  const lmv=nota(/(?:^|[\n;.])\s*(?:lmv|faturamento|receita mensal|faixa de faturamento)\s*[:=-]\s*[^\n;]{2,}/);
  const qualif=nota(/(?:^|[\n;.])\s*(?:dor|necessidade|perfil|motivo do interesse|objetivo)\s*[:=-]\s*[^\n;]{2,}/);
  const escolha=nota(/(?:duas opcoes de horario|dois horarios|opcao de horario|horarios disponiveis)/);
  const valorizacao=nota(/(?:reuniao.*(?:beneficio|rapida|entender|demonstracao)|demonstracao.*(?:beneficio|solucao))/);
  const result=notas.filter(n=>/(?:nao atendeu|reagendou|respondeu|agendou|desqualificou|sem interesse|confirmou)/.test(normal(n.texto)));
  const tarefasVencidas=tarefas.filter(t=>!t.concluida&&t.previstaPara&&Number.isFinite(Date.parse(t.previstaPara))&&Date.parse(t.previstaPara)<Date.now());
  const tarefasCumpridas=tarefas.filter(t=>t.concluida&&Boolean(t.concluidaEm));
  const eventos=Array.isArray(leitura.eventos)?leitura.eventos:[];
  const primeiro=eventos.filter(e=>e.data&&e.tipo!=='ENTRADA_ETAPA').sort((a,b)=>a.data.localeCompare(b.data))[0];
  const criada=String((leitura.negociacao||{}).criadaEm||'');
  const atrasoPrimeiro=primeiro&&criada&&Date.parse(primeiro.data)>=Date.parse(criada)
    ?Math.round((Date.parse(primeiro.data)-Date.parse(criada))/60000):null;
  const itens=[];
  function item(id,titulo,status,explicacao,acao,fonte,prioridade,evidencia,pilar) {
    itens.push({id:id,titulo:titulo,status:status,detalhe:explicacao,
      acao:acao,fonte:fonte,prioridade:prioridade||'MEDIA',
      evidencia:evidencia||'',pilar:pilar||'COMPLEMENTAR',
      regra:'Plano de Otimizacao SDR Wisetec (referencia); nao e score por lead.'});
  }
  item('cadencia','Uso da cadencia e tentativas',''+(registrosCadencia.length?'INDICIO':'NAO_VERIFICAVEL'),
    registrosCadencia.length?'Foram localizadas '+registrosCadencia.length+' tarefa(s) de cadencia. Tarefa criada nao comprova contato executado.':'Sem sequencia de cadencia suficiente para comparar com o playbook.',
    'Reconciliar passos, datas e resultados com a sequencia aprovada.','Tarefas RD','ALTA','','OFICIAL');
  item('voip','Uso do VoIP nas tentativas',voip.length?'EVIDENCIADO':'NAO_VERIFICAVEL',
    voip.length?'Ha '+voip.length+' chamada(s) com duracao ou referencia no board em '+dias.length+' dia(s). Nao prova conversa nem pitch.':
      'Nenhuma ligacao verificavel foi vinculada ao lead no board consultado.',
    'Conferir as gravacoes e vinculo de cada tentativa ao lead.','Board / API4COM','MEDIA','','OFICIAL');
  item('pitch','Aplicacao do pitch de qualificacao','NAO_VERIFICAVEL',
    'Aderencia a abertura, perguntas, objecoes e encerramento exige audio/transcricao atribuida ao SDR.',
    'Vincular audio e auditar o pitch Wisetec correto para o tipo de ligacao.','Gravacao SDR nao lida','MEDIA','','OFICIAL');
  item('no_show','Cadencia de recuperacao de no-show',
    planoNoShow?(followNoShow?'INDICIO':'ATENCAO'):'NAO_APLICAVEL',
    !planoNoShow?'Nao ha ocorrencia explicitamente identificada de no-show nesta leitura.':
      followNoShow?'Ha sinal de no-show e tarefa relacionada; confirmar que a cadencia ocorreu.':
      'Ha sinal de no-show, mas nao foi recuperada uma tarefa posterior de recuperacao.',
    'Conferir o no-show, ativar retomada prevista e confirmar novo horario com o lead.',
    'Anotacoes e tarefas RD','ALTA',detalhe(noShow),'OFICIAL');
  item('handoff','Passagem de bastao SDR para closer',
    passagem?'INDICIO':'NAO_VERIFICAVEL',
    passagem?'Anotacao menciona o repasse; aceite, contexto e responsavel ainda devem ser conferidos.':
      encontroComData.length?'A reuniao foi marcada mas o repasse efetivo ao closer nao foi confirmado.':
      'Nao ha evidencia clara de repasse nas fontes disponibilizadas.',
    'Confirmar closer responsavel, resumo da qualificacao e aceite do agendamento.',
    'Anotacoes/tarefas RD','ALTA',detalhe(passagem),'OFICIAL');
  item('registros','Registros apos a realizacao da acao',
    result.length?'INDICIO':notas.length?'INDICIO':cA,
    result.length?'Foram encontradas '+result.length+' anotacao(oes) com resultado explicito; auditar a completude.':
      notas.length?'Ha notas, mas resultados de cada tentativa nao estao confirmados.':
      'Nenhuma anotacao interpretavel foi recuperada nesta consulta.',
    'Registrar canal, resultado, data e proximo passo apos cada acao efetiva.',
    'Atividades RD','MEDIA',detalhe(result.slice(-1)[0]||null),'OFICIAL');
  item('tarefas','Marcacao e execucao de tarefas no prazo',
    tarefasVencidas.length?'ATENCAO':tarefasCumpridas.length?'INDICIO':'NAO_VERIFICAVEL',
    tarefasVencidas.length?'Ha '+tarefasVencidas.length+' tarefa(s) abertas vencidas; conferir execucao fora do CRM.':
      tarefasCumpridas.length?tarefasCumpridas.length+' tarefa(s) concluidas com data no RD, sem auditoria de SLA completo.':
      'O historico nao permite comprovar constancia de marcacao e timing.',
    'Revisar tarefas vencidas, reconciliar com evidencias e definir prazos reais.',
    'Tarefas RD','ALTA','','OFICIAL');
  item('segmento','Segmento qualificado antes da agenda',segmento?'INDICIO':cA,
    segmento?'Segmento citado nas notas; validar com fala do comprador.':'Segmento nao foi encontrado em anotacao identificavel.',
    'Confirmar segmento e perfil conforme o pitch inicial.','Anotacoes RD','MEDIA',detalhe(segmento));
  item('lmv','LMV/faturamento validado',lmv?'INDICIO':cA,
    lmv?'LMV ou faturamento citado; falta confirmar valor e autoria no audio.':'LMV nao foi localizado nas notas consultadas.',
    'Confirmar faturamento com o lead, sem inferir pela empresa.','Anotacoes RD','ALTA',detalhe(lmv));
  item('qualificacao','Motivo e necessidade de contato',qualif?'INDICIO':cA,
    qualif?'Uma necessidade ou motivacao foi documentada.':'Motivo do interesse nao ficou explicitado nas anotacoes reconheciveis.',
    'Sintetizar motivo, segmento e contexto necessario ao closer.','Anotacoes RD','MEDIA',detalhe(qualif));
  item('agenda','Agenda com dia, horario e responsavel',
    encontroComData.length?'INDICIO':'NAO_VERIFICAVEL',
    encontroComData.length?'Ha '+encontroComData.length+' tarefa(s) de reuniao com data; nao prova aceite do convidado.':
      'Nao foi recuperado agendamento com data nesta fonte.',
    'Confirmar data, horario, participantes e responsavel pelo atendimento.',
    'Tarefas RD','ALTA');
  item('confirmacao','Confirmacao do agendamento pelo lead',
    envioConvite?'INDICIO':encontroComData.length?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    envioConvite?'Anotacao menciona confirmacao/convite, mas faltam provas de entrega e aceite.':
      'Nao ha confirmacao inequivoca do cliente via canal autenticado.',
    'Verificar aceite do convite e contato de confirmacao antes da reuniao.',
    'Anotacoes RD / calendario nao integrado','MEDIA',detalhe(envioConvite));
  item('valor_reuniao','Valorizacao da reuniao no pitch',
    valorizacao?'INDICIO':'NAO_VERIFICAVEL',
    valorizacao?'Nota sugere explicacao do valor da reuniao, sem autoria de fala comprovada.':
      'Nao ha audio de SDR que permita verificar se o beneficio da reuniao foi apresentado.',
    'Na proxima ligacao, explicar o beneficio concreto da demo e conferir pelo audio.',
    'Pitch SDR / gravacao pendente','MEDIA',detalhe(valorizacao));
  item('horarios','Dupla opcao de horarios na proposta de agenda',
    escolha?'INDICIO':'NAO_VERIFICAVEL',
    escolha?'Anotacao menciona opcoes de horario, sem comparacao com pitch.':
      'Nao ha transcricao para confirmar oferta de dois horarios.',
    'Checar o pitch de agendamento com a gravacao atribuida ao SDR.',
    'Pitch SDR / gravacao pendente','BAIXA',detalhe(escolha));
  item('primeiro_registro','Tempo ate primeira evidencia registrada',
    atrasoPrimeiro===null?'NAO_VERIFICAVEL':'INDICIO',
    atrasoPrimeiro===null?'Nao ha marco de criacao ou primeiro registro comparavel.':
      atrasoPrimeiro+' minutos ate o primeiro registro; isso nao equivale ao tempo ate primeiro contato.',
    'Medir SLA de primeiro contato apenas quando houver tentativa com horario real.',
    'Linha do tempo RD / Board','MEDIA');
  item('resultado_ligacao','Resultado da tentativa identificado',
    conversa?'INDICIO':naoAtendeu?'INDICIO':cA,
    conversa?'Anotacao sugere dialogo, nao comprova interacao autenticada.':
      naoAtendeu?'Registro de nao atendimento; nao converter em conexao.':
      'Nao ha resultado de chamada explicitamente descrito.',
    'Registrar outcome real de cada tentativa e reconciliar com o audio.',
    'Anotacoes RD e ligacoes','MEDIA',detalhe(conversa||naoAtendeu));
  const contagem={EVIDENCIADO:0,INDICIO:0,ATENCAO:0,SEM_EVIDENCIA:0,NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
  itens.forEach(x=>{contagem[x.status]=(contagem[x.status]||0)+1;});
  return {
    titulo:'Plano de Otimizacao SDR',clienteReferencia:'Wisetec',
    versao:'2026-09-14 + sinais consultivos V3',pontuacao:null,
    oficial:itens.filter(x=>x.pilar==='OFICIAL').length,complementar:itens.filter(x=>x.pilar!=='OFICIAL').length,
    total:itens.length,contagem:contagem,itens:itens,
    restricoes:['Cadencia de dias e SLA de primeiro contato exigem playbook e calendario validos.',
      'Uso VoIP nao equivale a conversa ou qualidade de pitch.',
      'Sem audio/transcricao, nao inferir aderencia de pitch, dupla escolha ou objecoes.'],
    aviso:'Checklist consultivo para Wisetec: os sete pilares do plano sao referencia operacional, nao nota automatica. Avalia historico SDR mesmo se a negociacao estiver na etapa do closer.'
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
  const prompt = 'Voce e um auditor Sales Ops. Interprete apenas as evidencias fornecidas do mesmo lead. Responda SOMENTE JSON com: fatos (lista de objetos criterio, conclusao, fonte, data, confianca), lacunas (lista de objetos criterio, motivo, proximaVerificacao), recomendacoes (lista de objetos prioridade, acao, justificativa, criterioConclusao). '+
    'Nunca confunda tarefa criada com executada, e-mail enviado com recebido, arquivo PDF com entrega, link de convite com gravacao, ou anotacao do vendedor com mensagem direta do cliente. '+
    'NAO classifique ausencia de registro como falha quando a consulta for incompleta. Nao invente links ou datas. Evidencias: '+JSON.stringify(contexto);
  const resposta = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': chave },
    payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1400, responseMimeType: 'application/json' } }),
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


/**
 * V4 - leitura operacional por etapa e por evidência.
 * Não transforma volume total do lead em execução de SDR/Closer.
 * Critérios sem fonte continuam consultivos, nunca falhas automáticas.
 */
function viWidgetDiaBrasil_(valor) {
  const texto=String(valor||'').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const data=new Date(texto);
  if (!texto || !Number.isFinite(data.getTime())) return '';
  const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(data);
  const valores={}; partes.forEach(p=>{valores[p.type]=p.value;});
  return valores.year+'-'+valores.month+'-'+valores.day;
}
function viWidgetDiaExibicao_(valor) {
  const dia=viWidgetDiaBrasil_(valor);
  return dia ? dia.slice(8,10)+'/'+dia.slice(5,7)+'/'+dia.slice(0,4) : 'data não confirmada';
}
function viWidgetResumoTarefa_(tarefa) {
  const nome=String(tarefa.assunto||'Ação comercial').slice(0,90);
  const responsaveis=Array.isArray(tarefa.responsaveis)?tarefa.responsaveis:[];
  return {id:String(tarefa.id||''),assunto:nome,
    data:viWidgetDiaBrasil_(tarefa.dataOriginal||tarefa.previstaPara),
    responsavel:responsaveis.filter(Boolean).slice(0,2).join(', ')||'não confirmado',
    tipo:String(tarefa.tipo||'tarefa'),status:tarefa.concluida?'CONCLUÍDA':'ABERTA'};
}
function viWidgetRefinarParecerV4_(parecer,leitura) {
  const negociacao=leitura.negociacao||{};
  const fontes=leitura.fontes||{};
  const tarefas=Array.isArray(leitura.tarefas)?leitura.tarefas:[];
  const chamadas=Array.isArray(leitura.ligacoesBoard)?leitura.ligacoesBoard:[];
  const arquivosRd=Array.isArray(leitura.arquivosRd)?leitura.arquivosRd:[];
  const atividades=Array.isArray(leitura.atividades)?leitura.atividades:[];
  const etapa=viWidgetEtapa_(negociacao.etapaAtualNome);
  const encerrada=etapa.indice===6 ||
    negociacao.estadoFechamento==='GANHA'||negociacao.estadoFechamento==='PERDIDA';
  const emProposta=!encerrada&&/proposta|negociacao|follow|recovery|recuperacao/.test(viWidgetNormalizar_(negociacao.etapaAtualNome));
  const noCloser=!encerrada&&etapa.indice>=4&&etapa.indice<=5;
  const hoje=viWidgetDiaBrasil_(new Date());
  const abertas=tarefas.filter(t=>t&&t.concluida!==true)
    .map(viWidgetResumoTarefa_).filter(t=>t.data)
    .sort((a,b)=>a.data.localeCompare(b.data));
  const vencidas=abertas.filter(t=>t.data<hoje);
  const futuras=abertas.filter(t=>t.data>=hoje);
  const proxima=abertas[0]||null;
  const ultimas=chamadas.filter(c=>c&&c.data&&Number.isFinite(Date.parse(c.data)))
    .sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  const ultCall=ultimas[0]||null;
  const notas=atividades.filter(a=>a&&a.textoDisponivel&&a.texto &&
    ['note','response','messenger','whatsapp_transcription','email'].includes(String(a.tipo||'').toLowerCase()))
    .sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  const ultimaNota=notas[0]||null;
  const notasNormal=notas.map(a=>viWidgetNormalizar_(a.texto));
  const emails=atividades.filter(a=>a&&String(a.tipo||'').toLowerCase()==='email'&&a.textoDisponivel&&a.texto);
  const emailFormalizacao=emails.find(a=>/(?:formaliza|proposta\s+(?:foi\s+)?enviada|enviamos\s+(?:a\s+)?proposta|orcamento\s+enviado|segue\s+(?:a\s+)?proposta)/i.test(viWidgetNormalizar_(a.texto)))||null;
  const emailGravacao=emails.find(a=>a.temLinkGravacao===true||/(?:gravac|recording|tldv|grain|fireflies|fathom|loom|link\s+da\s+reuniao\s+(?:que\s+)?fizemos)/i.test(viWidgetNormalizar_(a.texto)))||null;
  const emailProximaReuniao=emails.find(a=>/(?:proxima\s+reuniao|meet\.google)/i.test(viWidgetNormalizar_(a.texto)))||null;
  const pdfs=arquivosRd.filter(a=>String(a.extensao||'').toLowerCase()==='pdf');
  const propostaPdf=pdfs.filter(a=>/(?:proposta|orcamento|apresentacao|comercial)/i.test(String(a.nome||'')));
  const promessaRecebida=notas.find(a=>viWidgetRecebimentoConfirmado_(a.texto)&&String(a.tipo||'').toLowerCase()!=='email')||null;
  const propostaRegistrada=atividades.some(a=>a.tipo==='proposal')||Boolean(emailFormalizacao)||
    notasNormal.some(t=>/(?:proposta\s+(?:foi\s+)?enviada|enviamos\s+(?:a\s+)?proposta|orcamento\s+enviado)/.test(t));
  const comValor=negociacao.valorInformado!==null && negociacao.valorInformado!==undefined &&
    Number.isFinite(Number(negociacao.valorInformado)) && Number(negociacao.valorInformado)>0;
  const dataFechamento=viWidgetDiaBrasil_(negociacao.previsaoFechamento);
  const coberturaRd=Boolean(fontes.tarefas&&fontes.tarefas.acessivel&&fontes.tarefas.completo&&
    fontes.atividades&&fontes.atividades.acessivel&&fontes.atividades.completo);
  const fatos=[];
  function fato(tipo,texto,fonte,confianca) {
    fatos.push({tipo:tipo,texto:texto,fonte:fonte,confianca:confianca||'DADO_RD'});
  }
  if (negociacao.etapaAtualNome) fato('ETAPA',
    'Etapa atual: '+negociacao.etapaAtualNome+'.','RD · negociação');
  if (negociacao.responsavel) fato('RESPONSAVEL',
    'Responsável atual: '+String(negociacao.responsavel).slice(0,70)+'.','RD · negociação');
  if (comValor) fato('VALOR',
    'Valor cadastrado na negociação: '+Number(negociacao.valorInformado).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+
    '. Não equivale ao valor do PDF aprovado.','RD · negociação');
  if (dataFechamento) fato('FORECAST',
    'Previsão de fechamento no CRM: '+viWidgetDiaExibicao_(dataFechamento)+'.','RD · negociação');
  if (proxima) fato('PROXIMA_TAREFA',
    'Tarefa aberta: '+proxima.assunto+' · '+viWidgetDiaExibicao_(proxima.data)+
    ' · Responsável: '+proxima.responsavel+'.','RD · tarefas');
  if (ultCall) fato('ULTIMA_CHAMADA',
    'Último registro de ligação: '+viWidgetDiaExibicao_(ultCall.data)+
    ' (duração informada: '+(Number(ultCall.duracaoSegundos)||0)+'s). Não prova diálogo.','Board · ligações','REGISTRO_TECNICO');
  if (ultimaNota) fato('ULTIMA_ANOTACAO',
    'Última anotação acessível: '+viWidgetDiaExibicao_(ultimaNota.data)+
    '. Conteúdo sujeito à conferência.','RD · atividades','INDICIO');
  if (emailFormalizacao) fato('EMAIL_FORMALIZACAO',
    'E-mail com sinal de formalização/proposta em '+viWidgetDiaExibicao_(emailFormalizacao.data)+
    '. O conteúdo não comprova anexo, entrega ou aceite.','RD · e-mail','INDICIO');
  if (emailGravacao) fato('EMAIL_GRAVACAO',
    'E-mail com referência contextual a gravação/reunião realizada em '+viWidgetDiaExibicao_(emailGravacao.data)+
    '. A referência não comprova realização ou conteúdo da reunião.','RD · e-mail','INDICIO');
  if (emailProximaReuniao) fato('PROXIMA_REUNIAO_EMAIL',
    'E-mail contém sinal de próxima reunião/convite. Confirmar aceite e realização no calendário.','RD · e-mail','INDICIO');
  if (propostaPdf.length) fato('PDF_PROPOSTA',
    propostaPdf.length+' PDF(s) com nome compatível com proposta/apresentação foram encontrados. O arquivo não comprova envio, leitura ou aceite.','RD · arquivos','INDICIO');
  else if (pdfs.length) fato('PDF_ANEXADO',
    pdfs.length+' PDF(s) anexado(s) à negociação; nome sem confirmação automática de proposta.','RD · arquivos','INDICIO');
  const avisos=[];
  const tarefasComAutoria=tarefas.filter(t=>Array.isArray(t.responsaveis)&&t.responsaveis.length>0).length;
  if (tarefas.length>0 && tarefasComAutoria<tarefas.length) avisos.push(
    (tarefas.length-tarefasComAutoria)+' tarefa(s) sem responsável identificado na resposta; não atribuir a SDR ou closer.');
  const chamadasSdrDeclaradas=chamadas.filter(c=>c&&c.funcaoDeclarada==='SDR'&&c.origemFuncao==='CAMPO_FUNCAO_BOARD').length;
  if (!chamadasSdrDeclaradas) avisos.push('Nenhuma ligação do board é atribuída ao papel SDR com função confirmada.');
  if (!coberturaRd) avisos.push('Consultas RD incompletas: ausência de registros não deve ser interpretada como falha.');
  if (emProposta) avisos.push(emailFormalizacao?
    'Há sinal de e-mail de formalização; ainda não confirma anexo, entrega ou aceite do comprador.':
    'Etapa “Proposta enviada” não comprova anexo PDF, entrega nem aceite do comprador.');
  const acoes=[];
  const ids=new Set();
  function acao(id,prioridade,titulo,motivo,conclusao,fonte) {
    if (ids.has(id)) return;
    ids.add(id);
    acoes.push({id:id,prioridade:prioridade,acao:titulo,porQue:motivo,
      criterioConclusao:conclusao,origem:fonte,evidencia:fonte});
  }
  if (encerrada) {
    acao('reconciliar-encerramento','BAIXA','Conferir o motivo e o histórico da negociação encerrada.',
      'O CRM indica encerramento; não iniciar cadência automaticamente.',
      'Resultado final e documentação revisados.','RD · negociação');
  } else {
    if (vencidas.length) acao('prazo','ALTA',
      'Revisar '+vencidas.length+' tarefa(s) em data passada; começar por “'+vencidas[0].assunto+'”.',
      'A primeira está datada de '+viWidgetDiaExibicao_(vencidas[0].data)+
      '. O registro sozinho não prova que a ação deixou de acontecer.',
      'Resultado real conferido e novo compromisso acertado, quando necessário.','RD · tarefas');
    if (emProposta) {
      if (!propostaRegistrada) acao('proposta','ALTA',
        'Verificar o envio efetivo da proposta e o PDF correspondente.',
        'O CRM está em “'+(negociacao.etapaAtualNome||'proposta')+
        '”, mas o leitor não confirma envio, destinatário ou anexo. Não é uma falha comprovada.',
        'Documento, valor, destinatário e data de envio verificados.','RD · etapa / anexos ainda não integrados');
      if (!promessaRecebida) acao('recebimento','MÉDIA',
        'Confirmar se o comprador recebeu e avaliou a proposta.',
        emailFormalizacao?
          'Há e-mail de formalização, mas envio não equivale a recebimento ou avaliação pelo comprador.':
          'Não há confirmação explícita identificável no texto recuperado, inclusive nas atividades de e-mail disponíveis.',
        'Recebimento e percepção do comprador registrados com data.','RD · e-mail / anotações');
      if (!comValor) acao('valor','MÉDIA',
        'Conferir o valor da proposta e o valor da negociação no CRM.',
        'O leitor não recuperou valor positivo do registro da negociação.',
        'Valor registrado e conciliado com a proposta válida.','RD · negociação');
      if (!dataFechamento||dataFechamento<hoje) acao('forecast','MÉDIA',
        'Atualizar a previsão de fechamento a partir do acordo com o comprador.',
        dataFechamento?'A data prevista no RD já passou.':'O campo de previsão não foi recuperado.',
        'Data realista registrada, com fundamento no compromisso do lead.','RD · negociação');
    }
    if (proxima) acao('proximo-passo','MÉDIA',
      'Executar ou revisar “'+proxima.assunto+'” ('+viWidgetDiaExibicao_(proxima.data)+').',
      'É a próxima tarefa datada no CRM. Responsável atribuído: '+proxima.responsavel+
      '. A tarefa não prova que o cliente aceitou esse compromisso.',
      'Resultado documentado e próximo acordo confirmado.','RD · tarefas');
    else if (fontes.tarefas&&fontes.tarefas.acessivel&&fontes.tarefas.completo)
      acao('proximo-passo','ALTA','Definir próximo passo com data e responsável.',
        'Nenhuma tarefa aberta datada foi encontrada na consulta completa de tarefas.',
        'Próximo compromisso definido e registrado no CRM.','RD · tarefas');
    else acao('fonte-tarefas','MÉDIA','Verificar o acesso às tarefas antes de concluir ausência de follow-up.',
      'A consulta às tarefas está incompleta ou inacessível.',
      'Acesso e paginação da fonte validados.','RD · tarefas');
    if (etapa.indice===3||etapa.indice===4) acao('reuniao','MÉDIA',
      'Confirmar o resultado da reunião e quem conduzirá a continuidade.',
      'A etapa no funil não prova a realização da reunião ou a passagem de bastão.',
      'Realização, responsável e próximo passo confirmados.','RD · etapa / reunião não verificada');
    if (etapa.indice<0) acao('mapa','MÉDIA',
      'Mapear a etapa à regra correta antes de emitir parecer de compliance.',
      'O nome da etapa não corresponde ao mapeamento operacional vigente.',
      'Etapa e regra homologadas.','RD · etapa');
  }
  if (!coberturaRd) acao('cobertura','MÉDIA','Completar a coleta de tarefas e atividades do RD.',
    'Há fonte incompleta; ela limita as conclusões.',
    'Consulta paginada e vínculo da negociação confirmados.','RD · integração');

  const ordem={ALTA:0,MÉDIA:1,BAIXA:2};
  acoes.sort((a,b)=>ordem[a.prioridade]-ordem[b.prioridade]);
  const chaveAtual=emProposta?['proposta','recebimento','proximo-passo','prazo','valor','previsao','decisor','objecoes','inatividade']:
    noCloser?['reuniao','proximopasso','decisor','dor','objecoes','previsao']:
    ['retorno','proximopasso','vencidas','reuniao','dor','lmv','responsavel','etapa'];
  const prioridadePos={};chaveAtual.forEach((id,i)=>prioridadePos[id]=i);
  const intel=parecer.inteligenciaComercial||{};
  const detalhados=Array.isArray(intel.itens)?intel.itens:[];
  const relevantes=detalhados.filter(x=>chaveAtual.includes(x.id)&&x.status!=='NAO_APLICAVEL')
    .sort((a,b)=>prioridadePos[a.id]-prioridadePos[b.id]);
  intel.relevantes=relevantes;
  intel.secundarios=detalhados.filter(x=>!relevantes.includes(x));
  intel.aviso='Critérios prioritários da etapa atual primeiro; os 27 critérios técnicos permanecem disponíveis para conferência. Sem fonte, não há falha presumida.';
  if (emProposta) {
    const meta=detalhados.find(x=>x.id==='proposta');
    if (meta) {
      meta.detalhe=propostaRegistrada?
        'Há menção ou atividade de proposta no RD; documento e entrega precisam ser verificados.':
        'A etapa do funil informa “Proposta enviada”; o leitor não consegue confirmar PDF, destinatário e envio.';
      meta.acao='Conferir o PDF, a data de envio e a confirmação no canal.';
      meta.status='NAO_VERIFICAVEL';
    }
    const forecast=detalhados.find(x=>x.id==='previsao');
    if (forecast && dataFechamento) forecast.detalhe=
      'Previsão informada no CRM: '+viWidgetDiaExibicao_(dataFechamento)+
      (dataFechamento<hoje?' (data já passou; revisar acordo).':' (ainda exige validação com comprador).');
  }
  if (intel.contagem) {
    const cont={ATENCAO:0,INDICIO:0,EVIDENCIADO:0,SEM_EVIDENCIA:0,
      NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
    detalhados.forEach(x=>{cont[x.status]=(cont[x.status]||0)+1;});
    intel.contagem=cont;
  }
  const planoSdr=parecer.planoOtimizacaoSdr||{};
  if (Array.isArray(planoSdr.itens)) {
    const contas={EVIDENCIADO:0,INDICIO:0,ATENCAO:0,SEM_EVIDENCIA:0,
      NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
    const diagnosticoSdr=new Set(['cadencia','voip','pitch','no_show','handoff','registros','tarefas',
      'segmento','lmv','qualificacao','agenda','confirmacao','valor_reuniao','horarios','primeiro_registro','resultado_ligacao']);
    planoSdr.itens.forEach(item=>{
      if (diagnosticoSdr.has(item.id) && item.status!=='NAO_APLICAVEL') {
        const anterior=item.status;
        item.status='NAO_VERIFICAVEL';
        if (item.id==='voip') item.detalhe=chamadas.length+
          ' chamada(s) vinculada(s) à negociação como um todo. O board não comprova quem atuou como SDR.';
        else if (item.id==='tarefas') item.detalhe=tarefas.length+
          ' tarefa(s) no histórico da negociação, sem separação confiável por SDR/closer. Não inferir SLA do SDR.';
        else if (item.id==='cadencia') item.detalhe=
          'Há tarefas com títulos de cadência, porém criá-las (inclusive automaticamente) não comprova execução pelo SDR.';
        else if (anterior==='ATENCAO') item.detalhe=
          'Sinal no histórico da negociação: '+item.detalhe+' Não atribuível ao SDR sem identificador de função.';
        else if (anterior==='INDICIO'||anterior==='EVIDENCIADO') item.detalhe=
          'Indício no lead, sem autoria/etapa SDR confirmada: '+item.detalhe;
      }
      contas[item.status]=(contas[item.status]||0)+1;
    });
    planoSdr.contagem=contas;
    planoSdr.atributoPapel='NAO_COMPROVADO';
    planoSdr.aviso='Sem mapeamento autenticado de usuários para o papel SDR, esta aba apresenta referência histórica do lead, não uma auditoria individual do SDR.';
  }
  const closer=parecer.criteriosPlanoWisetec||[];
  if (noCloser&&closer.length) {
    const valor=closer.find(x=>/Valores da proposta/.test(x.titulo||''));
    if (valor) {
      valor.status=comValor?'INDICIO':'NAO_VERIFICAVEL';
      valor.detalhe=comValor?'Valor positivo consta no campo da negociação; o PDF não foi conferido.':
        'Valor da proposta não pôde ser confirmado nas fontes disponíveis.';
    }
    const gravacao=closer.find(x=>/Link da gravação/.test(x.titulo||''));
    if (gravacao&&emailGravacao) {
      gravacao.status='INDICIO';gravacao.detalhe=
        'Atividade de e-mail em '+viWidgetDiaExibicao_(emailGravacao.data)+
        ' contém referência de gravação. Validar acesso, reunião correspondente e conteúdo separadamente.';
      gravacao.referencia='RD · e-mail';
    }
    const recebimento=closer.find(x=>/Confirmação de recebimento/.test(x.titulo||''));
    if (recebimento&&promessaRecebida) {
      recebimento.status='INDICIO';recebimento.detalhe=
        'Atividade '+viWidgetDiaExibicao_(promessaRecebida.data)+
        ' menciona recebimento, mas ainda exige verificação do canal.';
      recebimento.referencia='RD · atividade';
    }
    const tarefasProximas=closer.find(x=>/Tarefa com data e acordo/.test(x.titulo||''));
    if (tarefasProximas) {
      tarefasProximas.status=abertas.length?'INDICIO':'NAO_VERIFICAVEL';
      tarefasProximas.detalhe=abertas.length?
        'Próxima tarefa: '+proxima.assunto+' em '+viWidgetDiaExibicao_(proxima.data)+
        '. O aceite do comprador não está comprovado.':
        'Não há tarefa aberta datada confirmada nesta consulta; verificar acordo e acesso à fonte.';
    }
  }
  const foco=acoes[0]||null;
  parecer.versao='0.4.7';
  parecer.operacional={
    tipo:encerrada?'ENCERRADA':emProposta?'PROPOSTA_E_FOLLOWUP':
      noCloser?'REUNIAO_E_CONTINUIDADE':'QUALIFICACAO_E_CADENCIA',
    titulo:encerrada?'Negociação encerrada':emProposta?'Proposta em acompanhamento':
      noCloser?'Reunião e continuidade':'Conexão e qualificação',
    subtitulo:encerrada?'Consultar e reconciliar o resultado.':
      'Priorize apenas o que influencia a próxima decisão, sem supor execução.',
    fatos:fatos.slice(0,7),acoes:acoes.slice(0,5),
    proximaTarefa:proxima, tarefasEmDataPassada:vencidas.length,
    chamadasNoLead:chamadas.length,tarefasNoLead:tarefas.length,
    responsaveisEmTarefas:tarefasComAutoria,
    fonteRdCompleta:coberturaRd,notasDeConfiabilidade:avisos,
    criterioPrincipal:foco?foco.origem:'Sem fonte priorizável',
    papelSdrConfirmado:false
  };
  parecer.status=parecer.operacional.titulo.toUpperCase();
  parecer.risco=encerrada?'NÃO CLASSIFICADO':
    vencidas.length?'ALTO':(!coberturaRd?'MÉDIO':'NÃO CLASSIFICADO');
  parecer.confianca=coberturaRd?'PARCIAL (CANAIS EXTERNOS PENDENTES)':'BAIXA (COLETA INCOMPLETA)';
  parecer.resumoExecutivo=fatos.slice(0,4).map(x=>x.texto)
    .concat(avisos.slice(0,2));
  parecer.recomendacoes=acoes.slice(0,5);
  if (foco) {
    parecer.proximaAcao=foco.acao;
    parecer.regraDeDecisao=foco.criterioConclusao;
  }
  parecer.contextoIa={etapa:parecer.agenteAtual,status:parecer.status,
    cobertura:{atividades:fontes.atividades||{},tarefas:fontes.tarefas||{},arquivos:fontes.arquivosRd||{}},
    historico:atividades.filter(a=>a&&a.textoDisponivel).sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')))
      .slice(-30).map(a=>({data:a.data,tipo:a.tipo,fonte:'RD_ATIVIDADE',id:String(a.id||'').slice(0,60),
        texto:viWidgetSanitizar_(a.texto).slice(0,480),temLinkGravacao:!!a.temLinkGravacao})),
    tarefas:tarefas.slice(-30).map(t=>({id:String(t.id||'').slice(0,60),assunto:viWidgetSanitizar_(t.assunto),
      criadaEm:t.criadaEm,previstaPara:t.previstaPara,concluida:t.concluida,responsaveis:t.responsaveis})),
    arquivos:arquivosRd.slice(0,25).map(a=>({id:a.id,nome:viWidgetSanitizar_(a.nome),data:a.data})),
    reunioes:(leitura.reunioesCalendarioBoard||[]).slice(-12).map(r=>({id:r.id,data:r.data,status:r.status,
      gravacaoReferenciada:r.gravacaoReferenciada,resultadoRegistrado:r.resultadoRegistrado})),
    recomendacoes:acoes.slice(0,5).map(a=>({acao:a.acao,porQue:a.porQue}))};
  return parecer;
}


/**
 * Playbook VOLUM Sales Ops: leitura por etapa e por evidência.
 * Sem regra homologada do cliente, não atribui nota de compliance.
 */
function viWidgetPlaybookSalesOps_(leitura,parecer) {
  const etapa=viWidgetEtapa_((leitura.negociacao||{}).etapaAtualNome||'');
  const atividades=Array.isArray(leitura.atividades)?leitura.atividades:[];
  const tarefas=Array.isArray(leitura.tarefas)?leitura.tarefas:[];
  const chamadas=Array.isArray(leitura.ligacoesBoard)?leitura.ligacoesBoard:[];
  const fontes=leitura.fontes||{};
  const texto=atividades.filter(a=>a&&a.textoDisponivel&&a.texto).map(a=>viWidgetNormalizar_(a.texto)).join('\n');
  const emails=atividades.filter(a=>String((a||{}).tipo||'').toLowerCase()==='email'&&a.textoDisponivel);
  const tentativas=chamadas.filter(a=>a&&a.funcaoDeclarada==='SDR'&&a.origemFuncao==='CAMPO_FUNCAO_BOARD').length;
  const conversa=/(?:cliente|lead|prospect)\s+(?:respondeu|retornou|confirmou|conversou|falou)|(?:falamos|conversamos)\s+com/.test(texto);
  const qual=(parecer.qualificacao||[]).filter(x=>x.status==='INDICIO'||x.status==='EVIDENCIADO').length;
  const proxima=tarefas.some(t=>t&&!t.concluida&&t.previstaPara&&Number.isFinite(Date.parse(t.previstaPara)));
  const reunioesCalendario=Array.isArray(leitura.reunioesCalendarioBoard)?leitura.reunioesCalendarioBoard:[];
  const formalizacoesBoard=Array.isArray(leitura.formalizacoesBoard)?leitura.formalizacoesBoard:[];
  const gravacaoEmail=emails.some(a=>a.temLinkGravacao===true||/(?:gravac|recording|tldv|grain|fireflies|fathom|loom)/.test(viWidgetNormalizar_(a.texto)));
  const gravacaoBoard=reunioesCalendario.some(r=>r&&(r.gravacaoReferenciada||r.transcricaoReferenciada));
  const reuniaoRegistrada=reunioesCalendario.length>0;
  const gravacao=gravacaoEmail||gravacaoBoard;
  const pdfProposta=(Array.isArray(leitura.arquivosRd)?leitura.arquivosRd:[]).some(a=>String(a.extensao||'').toLowerCase()==='pdf'&&/(?:proposta|orcamento|apresentacao|comercial)/i.test(String(a.nome||'')));
  const formalizacao=emails.some(a=>/(?:formaliza|proposta\s+(?:foi\s+)?enviada|enviamos\s+(?:a\s+)?proposta|orcamento\s+enviado|segue\s+(?:a\s+)?proposta)/.test(viWidgetNormalizar_(a.texto)))||atividades.some(a=>String((a||{}).tipo||'').toLowerCase()==='proposal')||formalizacoesBoard.length>0||pdfProposta;
  const item=(id,titulo,status,detalhe,acao,referencia)=>({id,titulo,status,detalhe,acao,referencia});
  const etapas=[
    item('contexto','1. Contexto e responsável',etapa.indice>=0?'EVIDENCIADO':'NAO_VERIFICAVEL',etapa.indice>=0?'Etapa do CRM identificada.':'Etapa ou funil não confirmados.','Confirmar etapa, responsável e regra aplicável.','RD · negociação'),
    item('tentativa','2. Tentativa atribuída',tentativas?'EVIDENCIADO':chamadas.length?'NAO_VERIFICAVEL':'SEM_EVIDENCIA',tentativas?tentativas+' tentativa(s) com FUNCAO=SDR; isto não prova conversa.':chamadas.length?'Há ligação(ões), mas sem função comercial declarada.':'Nenhuma tentativa vinculada foi recuperada.','Atribuir tentativa somente quando a fonte declarar o papel.','Board · INTERACOES'),
    item('conexao','3. Conexão efetiva',conversa?'INDICIO':'NAO_VERIFICAVEL',conversa?'O histórico sugere resposta/conversa; validar no canal.':'Duração, tarefa ou tentativa não comprovam diálogo.','Confirmar resultado, canal e conteúdo antes de tratar como contato efetivo.','RD · atividades / gravações'),
    item('qualificacao','4. Qualificação para avanço',qual>=2?'INDICIO':'NAO_VERIFICAVEL',qual>=2?qual+' campo(s) de qualificação possuem indício textual.':'Contexto insuficiente para afirmar qualificação ou desqualificação.','Registrar dor, capacidade, decisor e critério de avanço.','RD · anotações'),
    item('continuidade','5. Acordo e próximo passo',proxima?'INDICIO':'NAO_VERIFICAVEL',proxima?'Existe tarefa futura datada; o aceite do cliente não está comprovado.':'Não foi recuperado próximo passo aberto e datado.','Confirmar responsável, data, canal e resultado esperado.','RD · tarefas'),
    item('reuniao','6. Reunião e passagem de bastão',etapa.indice<4?'NAO_APLICAVEL':gravacao?'INDICIO':'NAO_VERIFICAVEL',etapa.indice<4?'Ainda não é etapa de reunião/closer.':gravacao?(gravacaoBoard?'Há metadado de reunião com gravação/transcrição referenciada; validar realização e conteúdo.':'Há referência de gravação em e-mail; validar reunião e conteúdo.'):reuniaoRegistrada?'Há reunião vinculada no board; sem evidência de conteúdo, handoff ou pitch.':'Não há prova suficiente de reunião, handoff ou pitch.','Validar realização, resumo da qualificação, closer e próximo acordo.','RD · e-mail / transcrição'),
    item('proposta','7. Formalização, proposta e recovery',etapa.indice<5?'NAO_APLICAVEL':formalizacao?'INDICIO':'NAO_VERIFICAVEL',etapa.indice<5?'Ainda não é etapa de proposta/follow-up.':formalizacao?(pdfProposta?'Há PDF de proposta identificado e/ou sinal de formalização; não confirma entrega, recebimento ou aceite.':formalizacoesBoard.length?'Há registro de formalização associado; não confirma entrega, recebimento ou aceite.':'Há sinal de formalização; não confirma entrega, recebimento ou aceite.'):'Não foi localizada evidência de formalização.','Conferir documento, destinatário, recebimento, feedback e cadência.','RD · e-mail / propostas')
  ];
  const atual=etapa.indice>=5?etapas[6]:etapa.indice>=4?etapas[5]:etapa.indice>=3?etapas[4]:etapa.indice>=2?etapas[3]:etapa.indice>=1?etapas[2]:etapas[0];
  return {versao:'VOLUM_SALES_OPS_PLAYBOOK_V1',modelo:'EVIDENCIA_POR_ETAPA',compliance:'NAO_PONTUADO_SEM_REGRA_HOMOLOGADA',
    cobertura:(fontes.atividades||{}).completo&&(fontes.tarefas||{}).completo?'HISTORICO_RD_COMPLETO':'HISTORICO_RD_PARCIAL',
    decisaoAtual:{titulo:atual.titulo,status:atual.status,detalhe:atual.detalhe,acao:atual.acao},etapas:etapas,
    limites:['Registro de tentativa não comprova conversa.','E-mail de formalização não comprova recebimento ou aceite.','Sem playbook específico do cliente, a widget recomenda validações; não atribui nota de compliance.']};
}

/**
 * Consolida provas de origem sem inventar conversa ou autoria.
 * FUNCAO no Board = atribuicao declarada pela fonte, nao validacao de audio.
 * TRANSCRICOES.STATUS pendente = material nao interpretado, nao falta do vendedor.
 */
function viWidgetAdicionarEvidenciasBoard_(parecer,leitura) {
  const chamadas = Array.isArray(leitura.ligacoesBoard) ? leitura.ligacoesBoard : [];
  const reunioes = Array.isArray(leitura.reunioesBoard) ? leitura.reunioesBoard : [];
  const linhas = chamadas.concat(reunioes).filter(function(x) {return x && x.data;})
    .sort(function(a,b) {return String(b.data).localeCompare(String(a.data));});
  const atribuicao = chamadas.filter(function(x) {
    return x.funcaoDeclarada==='SDR' && x.origemFuncao==='CAMPO_FUNCAO_BOARD';
  });
  const closer = chamadas.filter(function(x) {
    return x.funcaoDeclarada==='CLOSER' && x.origemFuncao==='CAMPO_FUNCAO_BOARD';
  });
  const pendentes = linhas.filter(function(x) {
    return x.transcricaoBoardStatus==='PENDENTE' || x.transcricaoStatus==='PENDENTE';
  });
  const transcritas = linhas.filter(function(x) {return x.transcricaoDisponivel===true;});
  const duracoes = atribuicao.map(function(x){return Number(x.duracaoSegundos);})
    .filter(function(x){return Number.isFinite(x) && x>=0;});
  const menor = duracoes.length ? Math.min.apply(null,duracoes) : null;
  const maior = duracoes.length ? Math.max.apply(null,duracoes) : null;
  const resumo = {
    interacoes:linhas.length,ligacoes:chamadas.length,
    sdrDeclaradas:atribuicao.length,closerDeclaradas:closer.length,
    semPapel:chamadas.length-atribuicao.length-closer.length,
    transcricoesPendentes:pendentes.length,transcricoesLegiveis:transcritas.length,
    duracaoSdrMinima:menor,duracaoSdrMaxima:maior,
    metadadosTranscricoes:(leitura.fontes||{}).transcricoesBoard||{acessivel:false}
  };
  parecer.evidenciasBoard=linhas.slice(0,15).map(function(x) {
    return {
      id:String(x.id||'').slice(0,80),data:x.data,
      fonte:x.fonte||'BOARD',tipo:x.tipo||'INTERACAO',
      funcao:x.funcaoDeclarada||'NAO_COMPROVADO',
      origemFuncao:x.origemFuncao||'NAO_INFORMADA',
      responsavelRegistrado:viWidgetSanitizar_(String(x.responsavelRegistrado||'')).slice(0,80),
      duracaoSegundos:Number(x.duracaoSegundos)||0,
      gravacaoReferencia:Boolean(x.temReferenciaGravacao),
      statusTranscricao:x.transcricaoBoardStatus||x.transcricaoStatus||'NAO_INFORMADO',
      transcricaoDisponivel:Boolean(x.transcricaoDisponivel),
      tipoEvidencia:'REGISTRO_TECNICO_NAO_PROVA_DIALOGO'
    };
  });
  parecer.evidenciasBoardResumo=resumo;
  const operativo=parecer.operacional||{};
  operativo.evidenciasBoardResumo=resumo;
  const fatos=Array.isArray(operativo.fatos)?operativo.fatos:[];
  if(atribuicao.length){
    const duracao=menor!==null ?
      ' ('+menor+' a '+maior+' segundos no registro)' : '';
    const aviso=atribuicao.length+' chamada(s) com FUNCAO=SDR no board'+duracao+
      '; comprovam registros de tentativas, nao conversa ou qualificacao.';
    fatos.unshift({tipo:'TENTATIVAS SDR',texto:aviso,fonte:'Board · API4COM',
      confianca:'AUTORIA_DECLARADA_BOARD'});
    if(Array.isArray(parecer.resumoExecutivo))parecer.resumoExecutivo.unshift(aviso);
    const plano=parecer.planoOtimizacaoSdr||{};
    const voip=(plano.itens||[]).find(function(x){return x.id==='voip';});
    if(voip){
      voip.status='EVIDENCIADO';
      voip.detalhe='O board registra '+atribuicao.length+
        ' chamada(s) com FUNCAO=SDR e vinculo direto com a negociacao'+duracao+
        '. Evidencia de tentativa por VoIP; nao comprova atendimento, pitch ou dialogo.';
      voip.fonte='INTERACOES · FUNCAO, LINK_CRM e API4COM';
      voip.evidencia='Papel declarado no campo FUNCAO do board; audio ainda nao auditado.';
    }
    if(plano.contagem){
      const tally={EVIDENCIADO:0,INDICIO:0,ATENCAO:0,SEM_EVIDENCIA:0,
        NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
      (plano.itens||[]).forEach(function(x){tally[x.status]=(tally[x.status]||0)+1;});
      plano.contagem=tally;
      plano.atributoPapel='FUNCAO_DECLARADA_BOARD';
      plano.aviso='As tentativas VoIP com FUNCAO=SDR podem ser atribuidas ao papel SDR no board. Demais tarefas, pitch e conversas exigem provas proprias.';
    }
  }
  if(pendentes.length){
    const msg=pendentes.length+' interacao(oes) com transcricao ainda pendente,'
      +' sem base para auditar conteudo de conversa ou pitch.';
    if(Array.isArray(operativo.notasDeConfiabilidade))
      operativo.notasDeConfiabilidade.unshift(msg);
  }
  // O resumo nao deve inferir que nao ha autoria, quando o board possui FUNCAO=SDR.
  if(atribuicao.length && Array.isArray(operativo.notasDeConfiabilidade)){
    operativo.notasDeConfiabilidade=operativo.notasDeConfiabilidade.filter(function(texto){
      return !/nenhuma ligacao do board e atribuida ao papel sdr/.test(viWidgetNormalizar_(texto));
    });
  }
  operativo.fatos=fatos.slice(0,7);
  parecer.operacional=operativo;
  parecer.versao='0.4.7';
  return parecer;
}
