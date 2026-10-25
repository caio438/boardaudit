/**
 * VOLUM Intelligence - agentes contextuais de CONEXAO, AGENDA e REUNIAO.
 * Somente leitura. Registros, anotacoes e metadados nao equivalem a prova
 * de conversa, aderencia ao pitch, recebimento ou cumprimento integral.
 * Regras de cada cliente e versao do playbook devem ser homologadas.
 */
function viJourneyNormal_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}
function viJourneyTexto_(valor, limite) {
  return String(valor || '').replace(/https?:\/\/[^\s<>"']+/gi,'[LINK_OMITIDO]')
    .slice(0, limite || 180);
}
function viJourneyFonte_(evento) {
  if (!evento) return 'Fonte ainda nao identificada';
  return evento.fonte || evento.origemClassificacao || 'RD / Board';
}
function viJourneyProva_(evento) {
  if (!evento) return '';
  return [
    viJourneyTexto_(evento.id || '',65),
    viJourneyTexto_(evento.data || evento.criadaEm || evento.previstaPara || '',35),
    viJourneyTexto_(evento.autor || evento.responsavelRegistrado || '',60),
    viJourneyTexto_(evento.texto || evento.assunto || '',145)
  ].filter(Boolean).join(' · ').slice(0,300);
}
function viJourneyEvento_(atividade) {
  const a=atividade || {};
  return {id:String(a.id || ''),data:String(a.data || ''),
    tipo:String(a.tipo || '').toLowerCase(),
    acaoVisual:String(a.acaoVisual || ''),
    fonte:a.origemClassificacao==='RD_UI_HISTORY'?'RD_UI_HISTORY':'RD_ATIVIDADES',
    origemClassificacao:String(a.origemClassificacao || ''),
    texto:viJourneyTexto_(a.texto || '',320),
    autor:viJourneyTexto_(a.autor || a.autorId || '',80),
    passagemId:String(a.passagemId || ''),
    normal:viJourneyNormal_(a.texto || '')
  };
}
function viJourneyEventos_(ctx) {
  return (Array.isArray(ctx.atividades)?ctx.atividades:[])
    .filter(a=>a&&a.data).map(viJourneyEvento_)
    .sort((a,b)=>a.data.localeCompare(b.data));
}
/**
 * A CONEXAO nao recebe notas do Closer depois do agendamento. A primeira
 * referencia de agenda ou entrada em etapa de apresentacao encerra essa
 * janela. Sem eventos completos, o recorte continua consultivo.
 */
function viJourneyEscopoConexao_(ctx) {
  const eventos=viJourneyEventos_(ctx||{});
  const janelas=Array.isArray(ctx.janelas)?ctx.janelas:[];
  const inicioCloser=janelas.filter(j=>j&&j.inicio&&
    /apresenta|reuniao|demonstrac|proposta|negociac|follow|recovery|recupera/.test(
      viJourneyNormal_(j.etapaNome||j.nome||'')))
    .map(j=>j.inicio).sort()[0]||'';
  const agenda=viJourneyNotas_(eventos,'AGENDA')[0]||null;
  const fim=[inicioCloser,agenda?.data||''].filter(Boolean).sort()[0]||'';
  return {eventos:fim?eventos.filter(e=>e.data<=fim):eventos,
    fimConexao:fim,
    motivoFim:fim?(agenda?.data===fim?'AGENDA_REGISTRADA':'ENTRADA_ETAPA_CLOSER'):'SEM_MARCO'};
}
function viJourneyAfirmativa_(texto, categoria) {
  const t=viJourneyNormal_(texto);
  if(!t)return false;
  const comuns=/\b(vamos|preciso|pretendo|quero|tentando|aguardando|solicitar|solicitamos|ainda nao|nao foi|sem retorno|sem confirmacao)\b/;
  if(categoria==='CONEXAO')
    return !/\b(nao atendeu|nao respondeu|nao consegui contato|sem resposta|tentando contato|sem conexao)\b/.test(t) &&
      /(?:falei|conversei|conversamos|ligacao atendida|cliente respondeu|lead respondeu|resposta do cliente|dialogo com cliente|conexao realizada)/.test(t);
  if(categoria==='AGENDA')
    return !/(?:nao foi agendad|nao conseguiu agendar|sem agendamento|tentando agendar|pretend[eo] agendar|reagendar|desmarc|cancelad|a confirmar|aguardando confirmacao)/.test(t) &&
      /(?:reuniao|apresentacao|demonstracao|videochamada|encontro).{0,65}(?:agendad|marcad|confirmad)|(?:agendamos|marcamos).{0,45}(?:reuniao|apresentacao|demonstracao)/.test(t);
  if(categoria==='PRESENCA')
    return !/(?:nao confirmou|sem confirmacao|aguardando confirmacao|preciso confirmar|perguntar se confirmou|nao aceitou)/.test(t) &&
      /(?:cliente|lead|comprador|participante|contato).{0,60}(?:confirmou|aceitou).{0,35}(?:presenca|participacao|convite)|(?:presenca confirmada pelo cliente|cliente confirmou o horario)/.test(t);
  if(categoria==='NO_SHOW')
    return !/(?:nao houve no.?show|sem no.?show|nao foi no.?show|nao faltou|nao ocorreu falta)/.test(t) &&
      /(?:no.?show|cliente nao compareceu|lead nao compareceu|comprador nao compareceu|cliente faltou a reuniao|nao apareceu na reuniao)/.test(t);
  if(categoria==='REALIZADA')
    return !/(?:nao foi realizad|sem reuniao|nao aconteceu|nao compareceu|foi cancelad|desmarc|nao ocorreu)/.test(t) &&
      /(?:reuniao|apresentacao|demonstracao).{0,60}(?:realizad|concluid|aconteceu)|(?:realizamos|fizemos|concluimos) (?:a |uma )?(?:reuniao|apresentacao|demonstracao)/.test(t);
  if(categoria==='RECEBIMENTO')
    return !/(?:nao recebeu|nao chegou|sem confirmacao|aguardando|preciso confirmar|perguntamos|perguntei|recebeu\?|chegou tudo\?|confirmar recebimento)/.test(t) &&
      /(?:cliente|comprador|lead|contato).{0,75}(?:confirmou|acusou|informou).{0,35}(?:recebimento|que recebeu|proposta recebida)|(?:cliente disse que recebeu|cliente confirmou o recebimento)/.test(t);
  if(categoria==='LMV')
    return !/(?:nao validado|nao confirmado|preciso validar|pendente de validacao|aguardando validacao)/.test(t) &&
      /(?:lmv|faturamento|receita).{0,65}(?:confirmad|validado|validada|informado pelo cliente)|(?:cliente confirmou|lead confirmou).{0,45}(?:faturamento|receita|lmv)/.test(t);
  if(categoria==='CONVITE')
    return !/(?:vou enviar|preciso enviar|nao enviei|ainda nao enviei|sem convite|aguardando envio)/.test(t) &&
      /(?:enviei|enviamos|encaminhei|enviado).{0,50}convite|convite.{0,35}(?:enviado|encaminhado)/.test(t);
  if(categoria==='LEMBRETE')
    return !comuns.test(t) && /(?:enviei|enviamos|encaminhei|disparei).{0,45}lembrete|lembrete.{0,30}(?:enviado|encaminhado)/.test(t);
  return false;
}
function viJourneyNotas_(eventos, categoria) {
  return eventos.filter(e=>e.tipo==='note' && viJourneyAfirmativa_(e.normal,categoria));
}
function viJourneyBusca_(eventos, predicado) {
  return eventos.filter(predicado).sort((a,b)=>a.data.localeCompare(b.data))[0] || null;
}
function viJourneyEstado_(ctx,registros) {
  const origem=ctx||{};
  if(registros)return 'INDICIO';
  return origem.historicoVisualCompleto===true?'NAO_VERIFICAVEL':'FONTE_INCOMPLETA';
}
function viJourneyItem_(id,titulo,status,detalhe,evidencia,acao,regra,fonte) {
  return {id,titulo,status,
    conformidade:status==='NAO_APLICAVEL'?'NAO_APLICAVEL':'PENDENTE',
    detalhe:viJourneyTexto_(detalhe,550),
    evidencia:viJourneyProva_(evidencia),
    fonte:fonte || viJourneyFonte_(evidencia),
    acao:acao || '',paraFicarVerde:regra || 'Validar regra, prazo e evidencia pertinente.'};
}
function viJourneyMontar_(agente,ctx,criterios,indicadores,limite) {
  const verificaveis=criterios.filter(x=>x.status==='EVIDENCIADO'||x.status==='INDICIO').length;
  const faltantes=criterios.filter(x=>x.status==='FONTE_INCOMPLETA'||x.status==='NAO_VERIFICAVEL').length;
  const recomendacoes=criterios.filter(x=>x.status!=='EVIDENCIADO'&&x.status!=='NAO_APLICAVEL'&&x.acao)
    .slice(0,4).map(x=>({criterioId:x.id,titulo:x.titulo,acao:x.acao,
      origem:x.fonte,evidencia:x.evidencia||'',status:x.status}));
  return {agente,estado:'AUDITORIA_CONTEXTUAL_PARCIAL',indicadores:Object.assign({
      eventosEvidenciados:verificaveis,criteriosSemConclusao:faltantes,
      historicoVisualCompleto:ctx.historicoVisualCompleto===true,
      pontuacaoCompliance:null},indicadores||{}),
    criterios,recomendacoes,
    limite:limite || 'Sem versao do playbook e fontes completas, nao ha nota final de compliance.'};
}

/** CONEXAO: a autoria de SDR e o dialogo nunca sao deduzidos de duracao. */
function viJourneyConexao_(ctx) {
  ctx=ctx||{};
  const escopo=viJourneyEscopoConexao_(ctx);
  const ev=escopo.eventos;
  const notas=ev.filter(x=>x.tipo==='note');
  const chamadas=(ctx.ligacoes||[]).filter(x=>x&&x.data&&String(x.funcaoDeclarada||'').toUpperCase()!=='CLOSER'&&
    (!escopo.fimConexao||x.data<=escopo.fimConexao))
    .sort((a,b)=>a.data.localeCompare(b.data));
  const resposta=viJourneyBusca_(ev,e=>e.acaoVisual==='EMAIL_RESPONDIDO'||e.tipo==='response');
  const dialogo=viJourneyNotas_(ev,'CONEXAO')[0]||null;
  const evidenciaContato=dialogo||resposta;
  const origemContato=dialogo?'NOTA_RD':resposta?'RESPOSTA_RD':'NAO_DETERMINADA';
  const canais=[];
  if(chamadas.length)canais.push('LIGACAO_TECNICA');
  if(resposta)canais.push('RESPOSTA_EMAIL');
  if(dialogo)canais.push('CONTATO_RELATADO_EM_NOTA');
  const textoWhats=viJourneyBusca_(notas,e=>
    /(?:cliente|lead|comprador).{0,45}(?:respondeu|retornou).{0,40}(?:whats|zap)|(?:whats|zap).{0,40}(?:cliente|lead).{0,30}(?:respondeu|retornou)/.test(e.normal) &&
    !/(?:nao respondeu|sem resposta|aguardando)/.test(e.normal));
  if(textoWhats)canais.push('WHATSAPP_RELATADO');
  const lmv=viJourneyNotas_(ev,'LMV')[0]||null;
  const dor=viJourneyBusca_(notas,e=>
    /(?:dor|necessidade|desafio|problema|objetivo|demanda|dificuldade|prioridade)/.test(e.normal)&&
    !/(?:sem informacao|nao identificado|a validar)/.test(e.normal));
  const decisor=viJourneyBusca_(notas,e=>/(?:decisor|tomador de decisao|responsavel pela decisao|quem aprova)/.test(e.normal));
  const objecao=viJourneyBusca_(notas,e=>/(?:objecao|preco|valor alto|orcamento|concorrente|timing|prazo|nao faz sentido|inviavel)/.test(e.normal));
  const classificacao=viJourneyBusca_(notas,e=>/\blmv (?:positivo|negativo)\b|(?:qualificado|desqualificado) por (?:lmv|faturamento)/.test(e.normal));
  const agenda=viJourneyNotas_(ev,'AGENDA')[0]||null;
  const auditSdr=(ctx.auditoriasBoard||[]).find(x=>x.tipo==='SDR'&&
    ['APROVADA','EM_REVISAO'].includes(x.estado))||null;
  const audios=chamadas.filter(x=>x.temReferenciaGravacao===true);
  const transcricoes=chamadas.filter(x=>x.transcricaoDisponivel===true||x.transcricaoBoardStatus==='CONCLUIDA');
  const conexaoData=evidenciaContato?.data||'';
  const criado=Date.parse(ctx.criadaEm||'');
  const conectado=Date.parse(conexaoData);
  const minutos=Number.isFinite(criado)&&Number.isFinite(conectado)&&conectado>=criado?
    Math.round((conectado-criado)/60000):null;
  const primeiroCanal=resposta?'EMAIL_RESPOSTA':textoWhats?'WHATSAPP_RELATADO':dialogo?'CONTATO_RELATADO': 'NAO_DETERMINADO';
  const itens=[
    viJourneyItem_('canal_conexao','Canal da conexao',
      canais.length?'INDICIO':viJourneyEstado_(ctx,false),
      canais.length?'Sinais por fonte: '+canais.join(', ')+'. Canal de origem da conversa ainda pode exigir confirmacao.':
        'Nenhum canal de conversa efetiva pode ser certificado nos registros disponiveis.',
      evidenciaContato||chamadas[0], 'Validar o primeiro canal de resposta do comprador e registrar o resultado.',
      'Distinguir ligacao efetuada, atendimento, resposta e contato humano.','RD / Board'),
    viJourneyItem_('marco_conexao','Quando houve a primeira resposta',
      evidenciaContato?'INDICIO':viJourneyEstado_(ctx,false),
      evidenciaContato?'Primeiro relato/registro de resposta em '+conexaoData+'. '+(minutos!==null?'Intervalo indicativo desde a entrada: '+minutos+' min.':'Criacao nao comparavel.'):
        'O primeiro marco de resposta/conversa ainda nao foi localizado.',
      evidenciaContato,'Conciliar o primeiro registro de resposta com a transicao de etapa.',
      'Encontrar resposta/ligacao atendida datada, sem atribuir SLA sem regra.','RD · historico'),
    viJourneyItem_('ligacao','Ligacoes de prospeccao x conversa',
      chamadas.length?'EVIDENCIADO':viJourneyEstado_(ctx,false),
      chamadas.length?chamadas.length+' chamadas tecnicas associadas (excluidas chamadas com papel CLOSER). Duracao nao comprova atendimento.':
        'Nao ha chamada tecnica de SDR identificada nesta coleta.',
      chamadas[0],'Conferir resultado tecnico e autoria antes de marcar conversa realizada.',
      'Conciliar chamada com outcome, autor e contato efetivo.','Board · telefonia'),
    viJourneyItem_('gravacao_sdr','Gravacao e transcricao SDR',
      transcricoes.length?'EVIDENCIADO':audios.length?'INDICIO':viJourneyEstado_(ctx,false),
      transcricoes.length?transcricoes.length+' metadado(s) de transcricao com conteudo/status; ainda sem leitura semantica.':
        audios.length?audios.length+' chamada(s) com referencia de gravacao, sem texto suficiente para auditar fala.':
        'Nenhuma gravacao/transcricao SDR comprovada para interpretar a conexao.',
      transcricoes[0]||audios[0], 'Localizar a transcricao e vincular ao playbook correto para auditar a conversa.',
      'Transcricao acessivel da ligacao correta com identidade de SDR confirmada.','Board · metadados de gravacao'),
    viJourneyItem_('pitch_sdr','Pitch e explicacao do valor',
      auditSdr?'INDICIO':'NAO_VERIFICAVEL',
      auditSdr?'O Board possui auditoria de pitch '+auditSdr.estado+
        ' validada na geracao, vinculada a esta interacao. Aderencia de pitch avaliada: '+
        (auditSdr.aderenciaPct===null?'nao calculada':auditSdr.aderenciaPct+'%')+
        '. Nao equivale a compliance operacional completo.':
        'A existencia de chamada ou transcricao nao comprova o conteudo, as perguntas nem a qualidade do pitch.',
      auditSdr?{id:auditSdr.idAuditoria,data:auditSdr.dataValidacao,
        texto:(auditSdr.pontos||[])[0]?.evidencia||'Auditoria de pitch validada'}:null,
      auditSdr?((auditSdr.pontos||[])[0]?.acao||
        'Revisar as correcoes na auditoria do Board e conferir na proxima ligacao.'):
        'Analisar transcricao autenticada e comparar com a versao do pitch SDR homologado.',
      'Trecho autenticado vinculado a regra de pitch e versao homologada.','Board · AUDITORIAS / Pitch SDR'),
    viJourneyItem_('lmv_validado','LMV validado pelo SDR',
      lmv?'INDICIO':viJourneyEstado_(ctx,false),
      lmv?'Anotacao relata validacao de LMV/faturamento; nao confundir com valor atual do formulario.':
        'Nao foi localizada declaracao inequivoca de LMV confirmado durante a conexao.',
      lmv,'Conferir valor/faixa, data, autoria SDR e fala do cliente.',
      'Distinguir LMV declarado na entrada e LMV validado pelo SDR.','RD · anotacoes / transcricao'),
    viJourneyItem_('dor_decisor','Dor, necessidade e decisor',
      dor||decisor?'INDICIO':viJourneyEstado_(ctx,false),
      dor||decisor?'Ha referencia de dor/contexto ou decisor; a qualidade da qualificacao exige leitura completa.':
        'Sem dados suficientes para verificar dor, objetivo e decisor.',
      dor||decisor,'Conferir perguntas de qualificacao e registrar o contexto que importa ao Closer.',
      'Dor, impacto, decisor e proxima decisao rastreaveis por fonte.','RD · anotacoes'),
    viJourneyItem_('classificacao_lmv','Decisao LMV positivo ou negativo',
      classificacao?'INDICIO':'NAO_VERIFICAVEL',
      classificacao?'Anotacao contem classificacao LMV; verificar regra e se foi validada na conexao.':
        'Nao inferir LMV positivo/negativo a partir do valor atual do negocio ou de tarefa.',
      classificacao,'Confirmar criterio LMV e classificar o lead somente com regra vigente.',
      'Faixa/criterio de LMV homologados e validacao do SDR evidenciada.','RD · anotacoes / playbook'),
    viJourneyItem_('handoff_conexao','Resultado e passagem para Agenda',
      agenda?'INDICIO':viJourneyEstado_(ctx,false),
      agenda?'Existe anotacao positiva de agendamento. Aceite, participantes e handoff exigem provas separadas.':
        'Sem comprovacao segura de agendamento ou passagem de bastao apos conexao.',
      agenda,'Conferir agenda, closer responsavel, combinados e contexto de passagem.',
      'Data, participantes, closer e contexto transferidos com registro.','RD · historico')
  ];
  return viJourneyMontar_('CONEXAO',ctx,itens,{
    canaisSinalizados:canais,primeiroCanalSinalizado:primeiroCanal,
    primeiraRespostaRegistradaEm:conexaoData,minutosAteRespostaIndicativa:minutos,
    fimJanelaConexaoEm:escopo.fimConexao,causaFimJanelaConexao:escopo.motivoFim,
    ligacoesTecnicasSdrOuSemPapel:chamadas.length,
    ligacoesComGravacao:audios.length,transcricoesReferenciadas:transcricoes.length,
    anotacoesLmvValidado:lmv?1:0,anotacoesDeDor:dor?1:0,
    auditoriasSdrVinculadas:auditSdr?1:0
  },'Conexao e pitch nao sao certificados por duracao, status de tarefa ou metadado de transcricao.');
}

/** AGENDA: considera datas do calendario e nao inventa presenca ou no-show. */
function viJourneyAgenda_(ctx) {
  ctx=ctx||{};
  const ev=viJourneyEventos_(ctx),notas=ev.filter(e=>e.tipo==='note');
  const tarefas=Array.isArray(ctx.tarefas)?ctx.tarefas:[];
  const reunioes=(ctx.reunioesCalendario||[]).filter(x=>x&&x.data);
  const tarefasReuniao=tarefas.filter(t=>t&&
    (t.tipo==='meeting'||/reuniao|apresentacao|demonstracao/.test(viJourneyNormal_(t.assunto))));
  const registrosAgenda=viJourneyNotas_(ev,'AGENDA');
  const primeiraAgenda=registrosAgenda[0]||null;
  const agendaData=primeiraAgenda?.data||'';
  const agendamentosReais=reunioes.filter(r=>!/CANCELAD|DESMARCAD/.test(String(r.status||'')));
  const proxima=agendamentosReais.slice().sort((a,b)=>a.data.localeCompare(b.data)).at(-1)||
    tarefasReuniao.filter(t=>t.previstaPara).slice().sort((a,b)=>a.previstaPara.localeCompare(b.previstaPara)).at(-1)||null;
  const dataReuniao=proxima?.data||proxima?.previstaPara||'';
  const statusReuniao=String(proxima?.status||'').toUpperCase();
  const horas=Date.parse(dataReuniao)>=Date.parse(agendaData)&&agendaData&&dataReuniao?
    Math.round((Date.parse(dataReuniao)-Date.parse(agendaData))/3600000*10)/10:null;
  const emails=ev.filter(e=>e.acaoVisual==='EMAIL_ENVIADO'||e.tipo==='email');
  const conviteEnviado=viJourneyBusca_(emails,e=>/(?:convite|agenda|acesso.{0,30}reuniao|reuniao.{0,30}link)/.test(e.normal));
  const conviteNota=viJourneyBusca_(notas,e=>viJourneyAfirmativa_(e.normal,'CONVITE'));
  const confirmacao=viJourneyNotas_(ev,'PRESENCA').filter(e=>!agendaData||e.data>=agendaData)[0]||null;
  const lembrete=viJourneyBusca_(emails,e=>/lembrete|nossa reuniao|nosso compromisso/.test(e.normal))||
    viJourneyBusca_(notas,e=>viJourneyAfirmativa_(e.normal,'LEMBRETE'));
  const cancelada=viJourneyBusca_(notas,e=>/(?:reuniao|apresentacao).{0,60}(?:cancelad|desmarcad|reagendad)/.test(e.normal));
  const sinaisNoShow=viJourneyNotas_(ev,'NO_SHOW');
  const noShowCalendario=reunioes.filter(r=>/(NO[_ -]?SHOW|NAO[_ -]?COMPAREC)/.test(String(r.status||'')));
  const noShowSinal=noShowCalendario[0]||sinaisNoShow[0]||null;
  const marcoNoShow=noShowSinal?.data||dataReuniao;
  const retomar=tarefas.filter(t=>t&&/(?:no.?show|reagend|recovery|retomad|follow.?up|nova tentativa)/.test(
    viJourneyNormal_(String(t.assunto||'')+' '+String(t.anotacao||'')))&&
    (!marcoNoShow||(t.criadaEm||t.previstaPara||'')>=marcoNoShow));
  const registroHandoff=viJourneyBusca_(notas,e=>/(?:passagem de bastao|handoff|passado para closer|encaminhad.{0,30}closer|closer assumiu|resumo para closer)/.test(e.normal));
  const hoje=Date.parse(ctx.agora||new Date());
  const meetingMs=Date.parse(dataReuniao||'');
  const reuniaoFutura=Number.isFinite(meetingMs)&&meetingMs>hoje;
  const aconteceu=/(REALIZADA|CONCLUIDA|EFETUADA)/.test(statusReuniao);
  const naoAplicavelNoShow=!noShowSinal;
  const itens=[
    viJourneyItem_('agenda_registro','Agendamento na jornada',
      primeiraAgenda||proxima?'INDICIO':viJourneyEstado_(ctx,false),
      primeiraAgenda||proxima?'Existe registro de agendamento ou compromisso datado, sem assumir aceite.':
        'Nao foi identificado agendamento afirmativo ou compromisso datado.',
      primeiraAgenda||proxima,'Conferir quando e por qual canal a reuniao foi combinada.',
      'Agendamento datado, com contexto e responsavel confirmado.','RD · historico / calendario'),
    viJourneyItem_('agenda_data','Data e hora da reuniao',
      dataReuniao?'EVIDENCIADO':viJourneyEstado_(ctx,false),
      dataReuniao?'Compromisso previsto para '+dataReuniao+'; tarefa/calendario nao comprova realizacao.':
        'Data/hora do compromisso nao recuperada da fonte estruturada.',
      proxima,'Vincular compromisso a data/hora, participantes e canal de acesso.',
      'Compromisso datado com horario local e participantes.','RD · tarefas / Board calendario'),
    viJourneyItem_('agenda_intervalo','Intervalo entre agendamento e reuniao',
      horas!==null?'INDICIO':'NAO_VERIFICAVEL',
      horas!==null?horas+' hora(s) entre registro de agenda e horario previsto. A regra de lembrete depende dessa janela.':
        'Sem ambos os marcos datados, nao avaliar antecedencia ou cobranca de lembretes.',
      primeiraAgenda,'Aplicar prazos proporcionais apos homologar a regua do cliente.',
      'SLA de agenda e prazos vigentes comparados a intervalos reais.','RD · historico / calendario'),
    viJourneyItem_('agenda_convite','Convite e link da reuniao',
      conviteEnviado?'EVIDENCIADO':conviteNota?'INDICIO':viJourneyEstado_(ctx,false),
      conviteEnviado?'Evento de envio de e-mail identificado; ainda nao prova aceite ou integridade do link.':
        conviteNota?'Anotacao relata convite enviado, sem evento de envio confirmado.':
        'Convite enviado nao identificado nesta captura.',
      conviteEnviado||conviteNota,'Conferir destinatarios e link de acesso antes do compromisso.',
      'Convite enviado no prazo a destinatarios corretos, com link valido.','RD · e-mails / anotacoes'),
    viJourneyItem_('agenda_confirmacao','Confirmacao positiva do comprador',
      confirmacao?'INDICIO':viJourneyEstado_(ctx,false),
      confirmacao?'Registro atribui confirmacao positiva de presenca ao comprador.':
        'Sem resposta positiva de presenca identificada; convite enviado nao equivale a confirmacao.',
      confirmacao,'Validar resposta do comprador e registrá-la separadamente do convite.',
      'Aceite explicito do comprador, datado e apos o convite.','RD · anotacoes / respostas'),
    viJourneyItem_('agenda_lembrete','Lembrete pre-reuniao',
      lembrete?'INDICIO':!dataReuniao?'NAO_VERIFICAVEL':
        reuniaoFutura?'NAO_VERIFICAVEL':viJourneyEstado_(ctx,false),
      lembrete?'Ha envio ou anotacao de lembrete; a antecedencia adequada exige regra aprovada.':
        'Lembrete nao confirmado; avaliar horario e janela disponivel antes de cobrar cadencia.',
      lembrete,'Conferir se havia tempo e obrigatoriedade para o lembrete nesta agenda.',
      'Lembrete executado no prazo aplicavel, com data/canal e destinatario.','RD · anotacoes / e-mail'),
    viJourneyItem_('agenda_handoff','Handoff do SDR para Closer',
      registroHandoff?'INDICIO':viJourneyEstado_(ctx,false),
      registroHandoff?'Anotacao relata transferencia para Closer, ainda sem validar a completude do resumo.':
        'Nao ha registro inequívoco da passagem com contexto e responsavel.',
      registroHandoff,'Conferir Closer, dor, LMV validado, historico e compromisso no RD.',
      'Handoff completo, atribuido e antes da reuniao.','RD · anotacoes / responsavel'),
    viJourneyItem_('agenda_no_show','No-show por reuniao',
      noShowSinal?'INDICIO':reuniaoFutura||aconteceu?'NAO_APLICAVEL':viJourneyEstado_(ctx,false),
      noShowSinal?noShowCalendario.length+' status de no-show em calendario e '+sinaisNoShow.length+
        ' anotacao(oes) de no-show; notas repetidas nao equivalem a eventos distintos.':
        reuniaoFutura?'Compromisso futuro; no-show ainda nao aplicavel.':
        aconteceu?'Reuniao registrada como realizada; sem no-show deste compromisso.':
        'Sem fonte suficiente para concluir se houve no-show ou quantas vezes.',
      noShowSinal,'Se houve falta, vincular cada ocorrencia a data e reuniao, sem duplicar notas.',
      'Status da reuniao e presenca confirmados por ocorrencia.','Board calendario / RD notas'),
    viJourneyItem_('agenda_recovery','Reagendamento e recovery apos no-show',
      naoAplicavelNoShow?'NAO_APLICAVEL':retomar.length?'INDICIO':viJourneyEstado_(ctx,false),
      naoAplicavelNoShow?'Nenhum no-show identificado; recovery especifico nao se aplica.':
        retomar.length?'Ha '+retomar.length+' tarefa(s) de retorno/reagendamento; criacao nao comprova tentativas.':
        'No-show identificado, sem tarefa de recuperacao identificada na fonte.',
      retomar[0]||noShowSinal,'Conciliar prazos, contatos executados e proximo compromisso apos cada no-show.',
      'Régua de no-show aplicada somente ao compromisso faltado, no prazo vigente.','RD · tarefas / Board calendario')
  ];
  return viJourneyMontar_('AGENDA',ctx,itens,{
    agendamentoRegistradoEm:agendaData,compromissoEm:dataReuniao,
    horasEntreAgendamentoEReuniao:horas,
    calendarioReunioes:reunioes.length,tarefasReuniao:tarefasReuniao.length,
    noShowsComStatusNoCalendario:noShowCalendario.length,
    anotacoesNoShowNaoDeduplicadas:sinaisNoShow.length,
    tarefasRecoveryCandidatas:retomar.length,
    lembreteRegistradoEm:lembrete?.data||'',
    confirmacaoRegistradaEm:confirmacao?.data||''
  },'Sem confirmacao de presenca, convite e tarefa nao comprovam reuniao realizada. No-show exige vinculo ao compromisso e nao e inferido pela falta de registro.');
}

/** REUNIAO: separa realizacao, diagnostico, formalizacao e follow-up. */
function viJourneyReuniao_(ctx) {
  ctx=ctx||{};
  const ev=viJourneyEventos_(ctx),notas=ev.filter(e=>e.tipo==='note');
  const tarefas=Array.isArray(ctx.tarefas)?ctx.tarefas:[];
  const calendario=Array.isArray(ctx.reunioesCalendario)?ctx.reunioesCalendario:[];
  const boardReunioes=Array.isArray(ctx.reunioesBoard)?ctx.reunioesBoard:[];
  const arquivos=Array.isArray(ctx.arquivos)?ctx.arquivos:[];
  const api=Array.isArray(ctx.atividadesApi)?ctx.atividadesApi:[];
  const reunioesRealizadas=calendario.filter(r=>/(REALIZADA|CONCLUIDA|EFETUADA)/.test(String(r.status||'')));
  const notaRealizada=viJourneyNotas_(ev,'REALIZADA')[0]||null;
  const marco=reunioesRealizadas[0]?.data||notaRealizada?.data||'';
  const realizada=reunioesRealizadas[0]||notaRealizada;
  const temEtapaProposta=/proposta|negociac|follow|recovery|recuperacao/.test(viJourneyNormal_(ctx.etapaAtual||''));
  const exigivel=Boolean(realizada||temEtapaProposta);
  const closers=boardReunioes.filter(r=>String(r.funcaoDeclarada||'').toUpperCase()==='CLOSER');
  const atendente=ctx.negociacao?.responsavel||'';
  const notaCloser=viJourneyBusca_(notas,e=>/(?:closer|executivo comercial|responsavel pela reuniao)/.test(e.normal));
  const auditCloser=(ctx.auditoriasBoard||[]).find(x=>x.tipo==='CLOSER'&&
    ['APROVADA','EM_REVISAO'].includes(x.estado))||null;
  const ligacoes=(ctx.ligacoes||[]).filter(r=>String(r.funcaoDeclarada||'').toUpperCase()==='CLOSER');
  const gravaBoard=calendario.find(r=>r.gravacaoReferenciada)||
    boardReunioes.find(r=>r.temReferenciaGravacao)||
    ligacoes.find(r=>r.temReferenciaGravacao)||null;
  const gravaRd=api.find(a=>a.temLinkGravacao===true&&
    (!marco||!a.data||a.data>=marco))||null;
  const mencao=viJourneyBusca_(ev,e=>/(?:gravacao|gravada|recording|tldv|link da reuniao gravada)/.test(e.normal)&&
    !/(?:nao temos gravacao|sem gravacao|nao foi gravada)/.test(e.normal));
  const transcript=calendario.find(r=>r.transcricaoReferenciada)||
    boardReunioes.find(r=>r.transcricaoDisponivel===true)||
    ligacoes.find(r=>r.transcricaoDisponivel===true)||null;
  const diagnostic=viJourneyBusca_(notas,e=>/(?:dor|necessidade|diagnostico|cen[aá]rio|objetivo|motivacao|problema|faturamento)/.test(e.normal)&&
    (!marco||e.data>=marco));
  const obje=viJourneyBusca_(notas,e=>/(?:objecao|duvida|preco|orcamento|concorrente|obstaculo|restricao)/.test(e.normal)&&(!marco||e.data>=marco));
  const enviados=ev.filter(e=>e.acaoVisual==='EMAIL_ENVIADO'||e.tipo==='email');
  const formalizacao=viJourneyBusca_(enviados,e=>/proposta|formaliz|orcamento|condicoes comerciais|resumo da reuniao/.test(e.normal)&&
    (!marco||e.data>=marco));
  const notaFormal=viJourneyBusca_(notas,e=>
    !/(?:nao enviei|vou enviar|preciso enviar|aguardando envio)/.test(e.normal)&&
    /(?:enviei|encaminhei|enviamos).{0,50}(?:proposta|formalizacao)/.test(e.normal));
  const pdf=arquivos.find(a=>String(a.extensao||'').toLowerCase()==='pdf'&&
    /proposta|orcamento|comercial/.test(viJourneyNormal_(a.nome||'')))||null;
  const confirmado=viJourneyNotas_(ev,'RECEBIMENTO').find(e=>!formalizacao||e.data>=formalizacao.data)||null;
  const follow=tarefas.filter(t=>t&&/(?:follow.?up|recovery|retorno|retomad|proximo passo|proposta|acompanhar)/.test(
    viJourneyNormal_(String(t.assunto||'')+' '+String(t.anotacao||'')))&&
    (!marco||!t.criadaEm||t.criadaEm>=marco));
  const proximo=follow.find(t=>t.previstaPara&&t.responsaveis?.length)||null;
  const agora=Date.parse(ctx.agora||new Date());
  const vencidas=follow.filter(t=>!t.concluida&&t.previstaPara&&Date.parse(t.previstaPara)<agora);
  const antes=calendario.filter(r=>r.data&&realizada?.data&&r.data<realizada.data);
  const itens=[
    viJourneyItem_('reuniao_responsavel','Responsavel Closer pela negociacao',
      closers.length?'EVIDENCIADO':notaCloser||atendente?'INDICIO':viJourneyEstado_(ctx,false),
      closers.length?'Existe interacao de REUNIAO com papel CLOSER declarado no Board.':
        notaCloser||atendente?'Ha responsavel atual ou anotacao sobre Closer; nao confirma autoria na data da reuniao.':
        'Nao foi possivel vincular Closer e reuniao de forma segura.',
      closers[0]||notaCloser,'Confirmar ownership do Closer e sua data de atribuicao.',
      'Responsavel Closer vinculado ao compromisso, com transicao e autoria registradas.','RD / Board'),
    viJourneyItem_('reuniao_realizacao','Reuniao efetivamente realizada',
      realizada?(reunioesRealizadas.length?'EVIDENCIADO':'INDICIO'):viJourneyEstado_(ctx,false),
      realizada?reunioesRealizadas.length?'Calendario registra reuniao realizada; confirmar participantes e duracao.':
        'Anotacao relata reuniao realizada; conferir calendario e resultado.':
        'Etapa comercial ou tarefa concluida nao prova reuniao realizada.',
      realizada,'Conferir calendario, resultado, participantes e eventuais remarcacoes.',
      'Realizacao atestada por status/registro datado e participantes.','Board calendario / RD'),
    viJourneyItem_('reuniao_gravacao','Gravacao da reuniao',
      gravaBoard||gravaRd?'EVIDENCIADO':mencao?'INDICIO':viJourneyEstado_(ctx,false),
      gravaBoard||gravaRd?'Referencia tecnica de gravacao encontrada; validar se abre e se pertence a reuniao.':
        mencao?'Registro menciona gravacao, sem referencia tecnica confirmada.':
        'Referencia de gravacao nao localizada na fonte acessivel.',
      gravaBoard||gravaRd||mencao,'Validar acesso e vinculo da gravacao da reuniao na nota ou formalizacao.',
      'Gravacao recuperavel vinculada ao compromisso certo.','Board / RD atividades'),
    viJourneyItem_('reuniao_transcricao','Transcricao disponivel para auditoria',
      transcript?'EVIDENCIADO':'NAO_VERIFICAVEL',
      transcript?'Metadado confirma referencia a transcricao; conteudo nao foi carregado neste agente.':
        'Transcricao de reuniao ainda nao disponivel em texto validado.',
      transcript,'Localizar conteudo da transcricao e anexar ID da interacao correta.',
      'Texto da reuniao correta recuperavel com fonte, participantes e data.','Board · metadados'),
    viJourneyItem_('reuniao_pitch','Aderencia ao pitch e tratamento das objecoes',
      auditCloser?'INDICIO':'NAO_VERIFICAVEL',
      auditCloser?'Auditoria do Board '+auditCloser.estado+
        ', validada na geracao e vinculada a esta reuniao. Os desvios dos quatro momentos sao consultivos ate revisao.':
        (obje?'Ha nota sobre possivel objecao, sem prova do que foi dito na reuniao.':
        'Ainda nao foi feito confronto de transcricao com pitch, objeções e playbook.'),
      auditCloser?{id:auditCloser.idAuditoria,data:auditCloser.dataValidacao,
        texto:(auditCloser.pontos||[])[0]?.evidencia||'Auditoria Closer validada'}:obje,
      auditCloser?((auditCloser.pontos||[])[0]?.acao||
        'Conferir os quatro momentos do pitch e a proxima conducao comercial.'):
        'Analisar falas, criterios e contexto do playbook para apontar lacunas reais.',
      'Trechos transcritos e vinculados a cada criterio do pitch validado.','Board · AUDITORIAS / Pitch Closer'),
    viJourneyItem_('reuniao_anotacao','Diagnostico e anotacao pos-reuniao',
      diagnostic?'INDICIO':viJourneyEstado_(ctx,false),
      diagnostic?'Nota posterior ao marco da reuniao contem contexto do comprador; completude permanece a verificar.':
        'Sem anotacao estruturada pos-reuniao confirmada.',
      diagnostic,'Completar diagnostico, necessidade, expectativas, objeções e compromissos.',
      'Anotacao estruturada com diagnostico, entendimento e fechamento.','RD · notas'),
    viJourneyItem_('reuniao_formalizacao','E-mail de formalizacao enviado',
      !exigivel?'NAO_APLICAVEL':formalizacao?'EVIDENCIADO':notaFormal?'INDICIO':viJourneyEstado_(ctx,false),
      !exigivel?'Ainda nao ha reuniao realizada nem etapa de proposta exigivel.':
        formalizacao?'Evento de e-mail enviado identificado; anexos e entrega ainda exigem verificacao.':
        notaFormal?'Nota relata envio, sem evento de e-mail confirmado.':
        'E-mail de formalizacao nao identificado.',
      formalizacao||notaFormal,'Verificar destinatario, resumo, gravação e proximos passos.',
      'Envio de formalizacao comprovado apos reuniao e antes do prazo homologado.','RD · e-mails'),
    viJourneyItem_('reuniao_proposta','PDF de proposta nos arquivos do RD',
      !exigivel?'NAO_APLICAVEL':pdf?'EVIDENCIADO':viJourneyEstado_(ctx,false),
      !exigivel?'Proposta nao exigivel antes da reuniao/etapa comercial.':
        pdf?'PDF compatível com proposta encontrado, sem verificar conteudo ou valor.':
        'PDF da proposta nao localizado; ausencia so pode ser concluida com aba Arquivos completa.',
      pdf,'Conferir anexo, versao, valores e exigibilidade no playbook.',
      'PDF correto anexado ao negocio e compativel com a proposta enviada.','RD · arquivos'),
    viJourneyItem_('reuniao_recebimento','Confirmacao de recebimento',
      !exigivel?'NAO_APLICAVEL':confirmado?'INDICIO':viJourneyEstado_(ctx,false),
      !exigivel?'Ainda sem formalizacao exigivel.':
        confirmado?'Anotacao relata confirmacao do comprador; nao equivale a comprovante externo de leitura.':
        'Nenhuma confirmacao positiva de recebimento identificada apos a formalizacao.',
      confirmado,'Obter e registrar confirmacao positiva sem confundir pergunta com resposta.',
      'Recebimento explicitamente confirmado apos o envio.','RD · notas / e-mail'),
    viJourneyItem_('reuniao_followup','Proximo passo e follow-up com data',
      !exigivel?'NAO_APLICAVEL':proximo?'INDICIO':follow.length?'INDICIO':viJourneyEstado_(ctx,false),
      !exigivel?'Aguardando reuniao ou etapa de proposta.':
        proximo?'Tarefa de retorno datada com responsavel registrado; acordo com cliente ainda nao foi verificado.':
        follow.length?'Tarefa(s) de continuidade encontradas, sem data/responsavel suficientes.':
        'Proximo passo nao comprovado pelos registros.',
      proximo||follow[0],'Conciliar proxima tarefa com compromisso combinado e conferir vencimentos.',
      'Tarefa, data/hora, responsavel, acordo e registro de execucao conciliados.','RD · tarefas')
  ];
  return viJourneyMontar_('REUNIAO',ctx,itens,{
    reunioesNoCalendario:calendario.length,reunioesRealizadasRegistradas:reunioesRealizadas.length,
    anotacoesReuniaoRealizada:notaRealizada?1:0,
    gravacaoComReferencia:Boolean(gravaBoard||gravaRd),
    transcricaoReferenciada:Boolean(transcript),
    emailFormalizacaoEnviado:Boolean(formalizacao),
    pdfPropostaEncontrado:Boolean(pdf),
    tarefasFollowup:follow.length,tarefasFollowupVencidas:vencidas.length,
    ownershipCloserConfirmadoNoBoard:closers.length>0,
    auditoriasCloserVinculadas:auditCloser?1:0,
    exigibilidadePosReuniao:exigivel,
    reunioesAnterioresAoMarco:antes.length
  },'Gravacao e transcricao sao metadados; qualidade de pitch, objecoes, valores e compromisso exigem conteudo e regras homologadas.');
}
