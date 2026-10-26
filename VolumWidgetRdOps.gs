/**
 * Diagnostico Sales Ops baseado no HISTORICO REAL DA NEGOCIACAO (RD_UI_HISTORY).
 * Nao usa Board/API4COM como substituto de etapas ou comprovante de conversa.
 * Regras de prazo especificas pertencem ao playbook homologado do cliente.
 */
function viWidgetDiagnosticoHistoricoRd_(leitura) {
  const h=leitura.historicoRdEtapas||{};
  const timeline=h.linhaDoTempo||{};
  const cobertura=timeline.cobertura||{};
  const bruto=Array.isArray(timeline.eventos)?timeline.eventos:[];
  const disponivel=cobertura.acessivel===true && bruto.length>0;
  const completo=disponivel && cobertura.completo===true &&
    Number(cobertura.totalVisual)===bruto.length &&
    !(cobertura.lacunas||[]).length;
  const atual=String((leitura.negociacao||{}).etapaAtualNome||'').trim();
  const normal=texto=>String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
  const basico=(v,n)=>String(v||'').slice(0,n||240);
  const fase=/proposta|negocia|follow|recovery|recupera/i.test(normal(atual))?'PROPOSTA':
    /apresenta|reuniao|agenda|demonstrac/i.test(normal(atual))?'APRESENTACAO':
    /qualific|interesse|conexao/i.test(normal(atual))?'CONEXAO':'PROSPECCAO';
  const eventos=bruto.map((e,i)=>{
    const texto=String(e.texto||'');
    const trecho=viWidgetSanitizar_(texto);
    return {ref:String(e.id||'UI_'+i),tipo:String(e.acao||'OUTRO_VISUAL_RD'),
      texto,trecho,normal:normal(texto),data:String(e.data||''),
      dataTexto:String(e.dataTexto||''),autor:basico(e.autor,100),
      etapa:basico(e.etapaNome,120),passagemId:String(e.passagemId||''),
      fonte:'RD_UI_HISTORY'};
  });
  const janelas=Array.isArray(h.janelas)?h.janelas:[];
  const ultima=janelas[janelas.length-1]||{};
  const ativas=eventos.filter(e=>ultima.passagemId&&e.passagemId===ultima.passagemId);
  const porTipo={};
  eventos.forEach(e=>{porTipo[e.tipo]=(porTipo[e.tipo]||0)+1;});
  const resumo={total:eventos.length,etapas:janelas.length,
    etapaAtual:atual,janelaAtualInicio:ultima.inicio||'',
    registrosNaEtapaAtual:ativas.length,
    porTipo,fonte:'RD_UI_HISTORY',
    origemVisual:disponivel,coberturaCompleta:completo,
    paginasCarregadas:Number(cobertura.paginasCarregadas||0)};
  if(!completo){
    return {ativo:false,estado:'COLETA_NAO_HOMOLOGADA',resumo,
      motivo:!disponivel?'Historico visual do RD nao recebido. O leitor da extensao deve carregar a aba Historico antes de auditar.':
        'Historico visual recebido, mas a paginacao ou conciliacao ainda esta incompleta.',
      limite:'Nao emitir parecer ou desvio por ausencia enquanto a cobertura visual do RD nao for completa.'};
  }

  // Eventos de UI: enviar email e abrir WhatsApp sao acoes diferentes.
  const doTipo=(tipos,fn)=>eventos.filter(e=>(Array.isArray(tipos)?tipos:[tipos]).includes(e.tipo)&&(!fn||fn(e)));
  const ultimaDe=es=>es.slice().sort((a,b)=>a.data.localeCompare(b.data)).at(-1)||null;
  const notas=doTipo('ANOTACAO');
  const enviados=doTipo('EMAIL_ENVIADO');
  const respostas=doTipo('EMAIL_RESPONDIDO');
  const aberturas=doTipo('WHATSAPP_ABERTO');
  const criadas=doTipo('TAREFA_CRIADA');
  const feitas=doTipo('TAREFA_CONCLUIDA');
  const movimentacoes=doTipo('ETAPA_ALTERADA');
  const naPassagem=e=>!ultima.passagemId||
    e.passagemId===ultima.passagemId||
    (e.etapa&&normal(e.etapa)===normal(atual));
  const notasDaEtapa=notas.filter(naPassagem);
  const emailsDaEtapa=enviados.filter(naPassagem);
  const criadasNaEtapa=criadas.filter(naPassagem);
  const buscar=(list,re)=>ultimaDe(list.filter(e=>re.test(e.normal)));
  const nNegada=/nao (?:foi |esta |est[aá] )?(?:agendad|confirmad|enviad|realizad)|tentando agendar|procurando agendar|aguardando confirmacao|sem confirmacao/;
  const agenda=buscar(notas.filter(e=>!nNegada.test(e.normal)),
    /(?:reuniao|apresentacao|demonstracao|encontro).{0,65}(?:agendad|marcad|confirmad)|(?:agendamos|marcamos).{0,40}(?:reuniao|apresentacao|encontro)|reuniao.{0,30}\d{1,2}\/\d{1,2}/);
  // Lembrete prova comunicacao de lembrete, NAO convite enviado ou link.
  const convite=buscar(enviados,/(?:convite|link.{0,30}(?:reuniao|apresentacao)|meet\.google)/)||
    buscar(notas,/convite enviado|te enviei o convite|convite no seu email/);
  const noShows=notas.filter(e=>
    !/(?:nao houve no.?show|sem no.?show|nao foi no.?show|nao faltou|nao ocorreu falta)/.test(e.normal)&&
    /(?:no.?show|cliente nao compareceu|lead nao compareceu|nao entrou na reuniao|nao compareceu a reuniao|faltou a reuniao|tinhamos nosso compromisso hoje.{0,100}(?:mas|porem|voce nao))/.test(e.normal));
  const noShow=ultimaDe(noShows);
  const compromissoRelatado=ultimaDe(notas.filter(e=>
    /(?:tinhamos|combinamos|marcamos|agendamos).{0,60}(?:compromisso|reuniao|encontro)|nosso compromisso hoje|nosso encontro hoje/.test(e.normal)&&
    !/(?:nao havia compromisso|nao marcamos|sem compromisso marcado)/.test(e.normal)));
  const reunioesFonte=(Array.isArray(leitura.reunioesCalendarioBoard)?
    leitura.reunioesCalendarioBoard:[]).filter(x=>x&&x.data);
  const compromissoApi=reunioesFonte.filter(x=>
    !/CANCELAD|DESMARCAD/.test(String(x.status||'').toUpperCase()))
    .sort((a,b)=>a.data.localeCompare(b.data))[0]||null;
  const marcoCompromisso=agenda||compromissoRelatado||noShow;
  const lembrete=buscar(enviados,/lembrete|nossa reuniao|nosso compromisso/)||
    buscar(notas,/lembrando.{0,70}(?:compromisso|reuniao|encontro)|logo vamos comecar nosso compromisso/);
  const confirmacao=buscar(notas.filter(e=>!nNegada.test(e.normal)&&(!agenda||e.data>=agenda.data)),
    /(?:cliente|lead|contato|comprador).{0,70}confirmou.{0,35}(?:presenca|participacao|convite)|(?:confirmou presenca|confirmou o convite|aceitou o convite)/);
  const realizada=buscar(notas.filter(e=>!/nao (?:foi )?realizad/.test(e.normal)),
    /(?:reuniao|apresentacao|demonstracao).{0,45}(?:realizada|aconteceu|concluida)|(?:realizamos|fizemos) (?:a |uma )?(?:reuniao|apresentacao)/);
  const propostaEmail=buscar(emailsDaEtapa,/proposta|formaliz|orcamento|condicoes comerciais/);
  const propostaAnotada=buscar(notasDaEtapa,/enviei.{0,50}proposta|proposta.{0,40}(?:enviada|encaminhada)/);
  const gravacao=buscar(notasDaEtapa.concat(emailsDaEtapa),/gravac|recording|tldv|link da reuniao gravada/);
  const recebimento=buscar(notasDaEtapa.filter(e=>
    !/chegou tudo|voce recebeu|recebeu a proposta\?|consegue confirmar|aguardando.{0,20}recebimento|nao recebeu/.test(e.normal)),
    /(?:cliente|comprador|lead|contato).{0,70}(?:confirmou|acusou).{0,30}(?:recebimento|que recebeu)|(?:ele|ela).{0,25}confirmou.{0,20}recebimento/);
  const recovery=buscar(criadasNaEtapa,/recovery|recupera|retomad/)||
    buscar(notas,/iniciar recovery|inicio de recovery/);
  const follow=buscar(criadasNaEtapa,/follow|retorno|acompanhamento|recuperacao/);
  const respondido=ultimaDe(respostas);
  const canais={emailsEnviados:enviados.length,emailsRespondidos:respostas.length,
    whatsappAbertos:aberturas.length,tarefasCriadas:criadas.length,
    tarefasConcluidas:feitas.length,anotacoes:notas.length,
    movimentos:movimentacoes.length};

  const criterios=[],acoes=[],fatos=[];
  const referencia=(e)=>e?e.ref+' · '+(e.dataTexto||e.data)+
    (e.autor?' · '+e.autor:'')+(e.etapa?' · '+e.etapa:''):'';
  const adicionar=(id,titulo,estado,evento,detalhe,acao,prioridade)=>{
    const evidenciado=evento&&referencia(evento);
    criterios.push({id,titulo,estado,
      evidencia:detalhe+(evento?' Registro: '+basico(evento.trecho,260):''),
      fonte:evento?'RD_UI_HISTORY · '+evidenciado:'RD_UI_HISTORY · '+atual,
      data:evento&&evento.data||'',acao});
    if((estado==='SEM_REGISTRO'||estado==='ATENCAO')&&acao)acoes.push({
      id,prioridade:prioridade||'MÉDIA',acao,porQue:detalhe+
        (evidenciado?' Evidência: '+evidenciado:''),
      criterioConclusao:({
        agendamento:'Data/hora, participantes, responsavel e link confirmados em convite ou calendario; vincular a anotacao de compromisso.',
        convite:'Evento de envio do convite com destinatarios, horario e link conferidos; lembrete nao substitui convite.',
        confirmacao:'Resposta afirmativa do comprador, datada apos o convite.',
        lembrete:'Lembrete enviado no prazo e no canal da regra vigente, com referencia do evento.',
        no_show:'Resultado da reuniao documentado com data e ausencia do cliente; reconciliação com agenda.',
        pendencia_etapa:'Tarefa revisada e mantida, transferida ou encerrada com justificativa, responsavel e data.'
      })[id]||'Registro correspondente identificado, com data, responsavel e resultado da acao.',
      origem:'RD_UI_HISTORY'});
  };
  const factual=(titulo,e,conteudo)=>{
    if(e)fatos.push({tipo:titulo,texto:conteudo||basico(e.trecho,270),
      fonte:'RD · Histórico · '+referencia(e),confianca:'REGISTRO_VISUAL'});
  };
  factual('ETAPA',ultimaDe(movimentacoes),ultimaDe(movimentacoes)?
    'Última movimentação registrada: '+basico(ultimaDe(movimentacoes).trecho,210):'');
  factual('EMAIL ENVIADO',ultimaDe(enviados),
    enviados.length+' e-mail(s) enviados aparecem no histórico. Último: '+
      (ultimaDe(enviados)?.dataTexto||'data não exibida')+'.');
  factual('WHATSAPP ABERTO',ultimaDe(aberturas),
    aberturas.length+' abertura(s) do WhatsApp Web. Abrir o canal não comprova envio da mensagem.');
  factual('ANOTAÇÃO',ultimaDe(notas),basico(ultimaDe(notas)?.trecho,300));
  factual('TAREFA CONCLUÍDA',ultimaDe(feitas),basico(ultimaDe(feitas)?.trecho,200));

  if(fase==='APRESENTACAO'){
    adicionar('agendamento','Reunião ou compromisso combinado',
      marcoCompromisso||compromissoApi?'INDICIO':'NAO_VERIFICAVEL',
      marcoCompromisso||compromissoApi?(agenda?'Há anotação de agendamento. ':
        compromissoApi?'Calendário vinculado contém compromisso datado. ':
        'Uma anotação relata compromisso/no-show, o que indica reunião prevista, mas não comprova aceite ou convite. ')+
        'Confirmar data, horário, participantes e link em fonte estruturada.':
        'Etapa Apresentação não prova agendamento; consultar calendário e notas antes de concluir ausência.',
      marcoCompromisso,'Conciliar o compromisso mencionado com calendário, horário e resultado antes de avaliar falha de agenda.','ALTA');
    adicionar('convite','Convite e acesso à reunião',
      convite?(convite.tipo==='EMAIL_ENVIADO'?'EVIDENCIADO':'INDICIO'):'NAO_VERIFICAVEL',convite,
      convite?'Há registro de convite ou link; verificar destinatários e acesso, não presumir aceite.':
        lembrete?'Lembrete foi enviado, mas NÃO comprova o envio ou o link do convite. Conferir e-mail original/calendário.':
        'Não foi encontrado convite inequívoco no Histórico; verificar e-mails completos e calendário.',
      'Confirmar o evento de envio do convite, destinatários, data/hora e link de acesso.','ALTA');
    adicionar('confirmacao','Confirmação do participante',confirmacao?'INDICIO':marcoCompromisso||compromissoApi?'NAO_VERIFICAVEL':'NAO_VERIFICAVEL',confirmacao,
      confirmacao?'Anotação indica confirmação; conferir o teor e quem confirmou.':
        marcoCompromisso||compromissoApi?'Há compromisso mencionado, mas não há resposta positiva do comprador nesta fonte.':
        'Sem data de reunião evidenciada, não é possível medir a confirmação exigida.',
      marcoCompromisso||compromissoApi?'Conferir se o comprador confirmou antes do compromisso.':'', 'MÉDIA');
    adicionar('lembrete','Lembrete pré-reunião',lembrete?(lembrete.tipo==='EMAIL_ENVIADO'?'EVIDENCIADO':'INDICIO'):'NAO_VERIFICAVEL',lembrete,
      lembrete?'Há envio de e-mail ou anotação de lembrete; verificar antecedência exigida na régua.':
        marcoCompromisso||compromissoApi?'Compromisso mencionado; lembrete não localizado e sua obrigação depende do intervalo e da régua.':
        'Não há compromisso datado para avaliar antecedência do lembrete.',
      marcoCompromisso||compromissoApi?'Conferir se a antecedência permitia lembrete obrigatório.':'','MÉDIA');
    adicionar('realizacao','Resultado da reunião',realizada?'INDICIO':'NAO_VERIFICAVEL',realizada||noShow,
      realizada?'Uma anotação registra a realização; a etapa, sozinha, não confirma quem participou.':
        noShow?'Há relato de no-show; isso NÃO é reunião realizada. Confirmar a ocorrência e o próximo reagendamento.':
        'Sem relato confiável de realização. Conferir resultado e participação no calendário/gravacão.',
      '', 'MÉDIA');
    if(noShow)adicionar('no_show','Ausência do comprador / no-show relatado','INDICIO',noShow,
      'Anotação relata ausência no compromisso. É indício de reunião prevista e não comprovação de agendamento aceito, presença ou gravação.',
      'Vincular no-show ao compromisso e checar a próxima tentativa/reagendamento.','MÉDIA');
  }else if(fase==='PROPOSTA'){
    adicionar('email_proposta','E-mail de formalização',propostaEmail?'EVIDENCIADO':propostaAnotada?'INDICIO':'SEM_REGISTRO',
      propostaEmail||propostaAnotada,
      propostaEmail?'O histórico comprova o evento de envio de e-mail com assunto de proposta/formalização. Não comprova anexo nem leitura.':
        propostaAnotada?'O vendedor informou por anotação que enviou proposta; o evento de envio não foi localizado.':
        'Etapa de proposta sem evento de e-mail enviado de formalização no Histórico completo.',
      'Localizar o envio de formalização com destinatário, proposta e próximos passos.','ALTA');
    adicionar('recebimento','Confirmação de recebimento',recebimento?'INDICIO':'SEM_REGISTRO',
      recebimento,recebimento?'A anotação atribui confirmação ao comprador; conferir texto e contexto.':
        'Nenhuma confirmação positiva de recebimento identificada no Histórico completo. Perguntar se chegou não é confirmação.',
      'Confirmar e registrar recebimento de proposta por e-mail ou WhatsApp.','ALTA');
    adicionar('gravacao','Link da reunião gravada',gravacao?'INDICIO':'SEM_REGISTRO',
      gravacao,gravacao?'Há menção à gravação no histórico, mas o link de acesso ainda deve ser conferido.':
        'Não há referência à gravação no Histórico consultado.',
      'Anexar ou registrar o link correto na anotação ou formalização.','MÉDIA');
    const houveFollow=follow||recovery;
    adicionar('cadencia_posterior','Follow-up ou recovery registrado',houveFollow?'EVIDENCIADO':'SEM_REGISTRO',
      houveFollow,houveFollow?'Existe tarefa de follow-up/recovery criada, o que não comprova sua execução.':
        'Nenhuma tarefa de follow-up ou recovery criada consta no Histórico completo.',
      'Criar tarefa de continuidade com responsável e data de execução.','ALTA');
    // Os arquivos da aba Propostas só podem ser classificados por fonte de arquivos,
    // não pela ausência de um PDF no Histórico visual.
    const arquivos=(leitura.arquivosRd||[]).filter(a=>/proposta|orcamento|comercial/i.test(a.nome||''));
    const arqCompleta=(leitura.fontes?.arquivosRd||{}).completo===true;
    adicionar('arquivo_proposta','Arquivo da proposta',
      arquivos.length?'EVIDENCIADO':arqCompleta?'SEM_REGISTRO':'NAO_VERIFICAVEL',null,
      arquivos.length?arquivos.length+' arquivo(s) compatíveis com proposta na aba Arquivos.':
        arqCompleta?'A fonte Arquivos foi consultada integralmente, sem proposta identificada.':
        'A captura do Histórico visual não comprova o conteúdo da aba Arquivos.',
      arqCompleta?'Conferir e anexar a versão correta da proposta.':'','MÉDIA');
  }else{
    const contato=buscar(notas,/falei com|conversamos|conversei|cliente respondeu|cliente retornou/);
    const qualificacao=buscar(notas,/faturamento|lmv|dor|desafio|decisor|sistema atual|necessidade/);
    adicionar('contato','Contato efetivo documentado',contato?'INDICIO':'SEM_REGISTRO',contato,
      contato?'Existe relato de conversa com o cliente; validar o conteúdo do registro.':
        'O Histórico completo não apresenta registro textual inequívoco de conversa com o comprador.',
      'Registrar o resultado da conexão (respondeu, interesse, objeção, próximo passo).','ALTA');
    adicionar('qualificacao','Qualificação documentada',qualificacao?'INDICIO':'SEM_REGISTRO',qualificacao,
      qualificacao?'Há referência textual à qualificação; conferir LMV, dor e critérios de avanço.':
        'Não há nota identificável de faturamento, dor ou qualificação no Histórico completo.',
      'Registrar LMV validado, contexto da dor e critério de avanço.','MÉDIA');
    adicionar('agendamento','Passagem para reunião',agenda?'INDICIO':'NAO_VERIFICAVEL',agenda,
      agenda?'Há registro de agendamento com o comprador.':
        'Ainda não há sinal de agendamento comprovado no histórico.',
      '','MÉDIA');
  }

  // Uma tarefa de prospecção pendente não deve virar automaticamente a
  // "próxima melhor ação" de uma oportunidade que já está em Apresentação.
  const abertas=Array.isArray(leitura.tarefas)?leitura.tarefas.filter(t=>t&&!t.concluida):[];
  const pendenciasSdr=abertas.filter(t=>/(?:terceira|primeira|segunda)\s+ligac|cad\s*\d|tentativa de contato/i.test(normal(t.assunto)));
  if(fase==='APRESENTACAO'&&pendenciasSdr.length){
    const t=pendenciasSdr[0];
    adicionar('pendencia_etapa','Tarefa de prospecção em etapa de reunião','ATENCAO',null,
      'A tarefa "'+basico(t.assunto,100)+'" está aberta, enquanto o negócio está em Apresentação. Não executar automaticamente sem verificar o objetivo atual.',
      'Revisar se a tarefa é remanescente de prospecção e atualizar responsável/data ou encerrar com justificativa.','MÉDIA');
  }
  const ordem={ALTA:0,MÉDIA:1,BAIXA:2};
  acoes.sort((a,b)=>ordem[a.prioridade]-ordem[b.prioridade]);
  const decisoes=acoes.slice(0,4);
  const sinal=criterios.filter(x=>x.estado==='SEM_REGISTRO'||x.estado==='ATENCAO').length;
  const positivos=criterios.filter(x=>x.estado==='EVIDENCIADO'||x.estado==='INDICIO').length;
  const titulo=fase==='APRESENTACAO'?'PREPARAÇÃO E RESULTADO DA REUNIÃO':
    fase==='PROPOSTA'?'FORMALIZAÇÃO E CONTINUIDADE':'CONEXÃO E QUALIFICAÇÃO';
  const sumario=[
    'Histórico nativo: '+eventos.length+' eventos em '+janelas.length+
      ' passagem(ns) de etapa; '+ativas.length+' registro(s) na etapa atual "'+atual+'".',
    enviados.length+' e-mail(s) enviado(s), '+respostas.length+' resposta(s) de e-mail, '+
      aberturas.length+' abertura(s) de WhatsApp, '+criadas.length+' tarefa(s) criada(s) e '+
      feitas.length+' concluída(s), cada tipo contado separadamente.'
  ];
  if(sinal)sumario.push(sinal+' obrigação(ões) com registro ausente ou ação a revisar segundo a etapa atual.');
  if(!sinal)sumario.push('Nenhuma ausência foi identificada pelos critérios básicos nesta etapa; o processo detalhado ainda exige regras homologadas.');
  return {ativo:true,estado:'HISTORICO_RD_COMPLETO',titulo,fase,etapaAtual:atual,
    resumo,canais,criterios,acoes:decisoes,fatos:fatos.slice(-5),
    sumario,semRegistro:sinal,evidenciados:positivos,
    limite:'Base exclusivamente RD_UI_HISTORY. Abertura de WhatsApp não prova envio; tarefa concluída não prova contato; agendamento não prova reunião realizada. A ausência de registro é apontada quando a coleta visual é completa. Não atribuir nota final sem regra vigente do cliente.'};
}


/**
 * Janela de evidencias compacta para interpretacao semantica. Apenas
 * RD_UI_HISTORY, referencias verificaveis e texto truncado/sanitizado.
 * Evita enviar os 103 cartões inteiros repetidamente à IA.
 */
function viWidgetContextoHistoricoRd_(leitura,diagnostico) {
  const h=leitura.historicoRdEtapas||{},janelas=h.janelas||[];
  const timeline=(h.linhaDoTempo||{}).eventos||[];
  const ultima=janelas[janelas.length-1]||{};
  const relevantes=timeline.filter(function(e) {
    return e.passagemId===ultima.passagemId ||
      ['ANOTACAO','EMAIL_ENVIADO','EMAIL_RESPONDIDO','ETAPA_ALTERADA','ALTERACAO'].includes(e.acao);
  });
  const selecionados=relevantes.slice(-52);
  return {
    fonte:'RD_UI_HISTORY',
    politica:'Use somente evidencias indicadas por UI_n. O CRM é fonte da execução documentada. Tarefa criada não comprova execução, abertura do WhatsApp não comprova envio, etapa Apresentação não prova reunião realizada. Falta de registro em histórico completo deve ser indicada e atribuída à obrigação vigente, sem inventar SLA.',
    etapaAtual:(leitura.negociacao||{}).etapaAtualNome||'',
    historicoCompleto:diagnostico.ativo===true,
    totalEventos:(diagnostico.resumo||{}).total||0,
    janelas:janelas.map(j=>({passagemId:j.passagemId,etapa:j.etapaNome,
      entrada:j.inicio,saida:j.fim,totalVisual:j.totalEventosHistoricoVisual||0})),
    referencias:selecionados.map(e=>({ref:e.id,tipo:e.acao,data:e.data,
      autor:String(e.autor||'').slice(0,90),etapa:e.etapaNome,
      texto:viWidgetSanitizar_(e.texto||'').slice(0,
        e.acao==='ANOTACAO'?700:260)})),
    verificacoes:(diagnostico.criterios||[]).map(c=>({criterio:c.titulo,status:c.estado,
      evidencia:String(c.evidencia||'').slice(0,230)})),
    recomendacoes:(diagnostico.acoes||[]).map(a=>({acao:a.acao,porQue:a.porQue}))
  };
}

function viWidgetAgenteEventoIa_(e,leitura){
  const stage=String(e.etapaNome||(leitura.historicoRdEtapas?.janelas||[])
    .find(j=>j.passagemId===e.passagemId)?.etapaNome||'');
  const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const t=normal(e.texto),s=normal(stage);
  if(/(?:no.?show|agendad|convite|confirmou presenca|reagend|lembrete)/.test(t))
    return 'AGENDA';
  if(/proposta|follow.?up|recovery|recebimento|negociac|reuniao realizada/.test(t)
      &&/apresenta|reuniao|proposta|negociac|follow/.test(s))return 'REUNIAO';
  if(/apresenta|reuniao|proposta|negociac|follow|closer/.test(s))return 'REUNIAO';
  if(/cadencia|prospecc|tentativa|primeir/.test(s))return 'CADENCIA';
  if(/qualific|conex|interesse/.test(s))return 'CONEXAO';
  return e.acao==='NEGOCIACAO_CRIADA'?'LEAD':'CADENCIA';
}
function viWidgetValidarInterpretacaoRd_(interpretacao,leitura,contextoEnviado) {
  if(!interpretacao || interpretacao.disponivel===false)
    return {disponivel:false,motivo:'IA_INDISPONIVEL',fatos:[],referenciasDescartadas:0};
  const eventos=((leitura.historicoRdEtapas||{}).linhaDoTempo||{}).eventos||[];
  const porId=new Map(eventos.map(e=>[String(e.id||''),e]));
  // Em producao, nao validar UI_n que existe no RD mas nao estava no
  // conjunto de referencias efetivamente submetido ao Gemini.
  const refPrompt=contextoEnviado&&Array.isArray(contextoEnviado.referencias)?
    new Set(contextoEnviado.referencias.map(x=>String(x.ref||''))):null;
  const normal=x=>String(x||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const origem=Array.isArray(interpretacao.fatos)?interpretacao.fatos:[];
  const validos=[];
  let descartadas=0;
  for(const f of origem){
    if(validos.length>=7)break;
    const ref=String(f?.referencia||f?.ref||'');
    const e=porId.get(ref);
    const conclusao=String(f?.conclusao||'').trim();
    if(!e||(refPrompt&&!refPrompt.has(ref))||!conclusao){descartadas++;continue;}
    const texto=normal(conclusao);
    const eventoTipo=String(e.acao||'OUTRO_VISUAL_RD');
    const fonteTexto=normal(e.texto||'');
    // Uma referencia existente nao autoriza afirmacoes incompatíveis com o
    // tipo do cartao. Estas regras so rejeitam; nunca elevam a conforme.
    const origemFraca=['WHATSAPP_ABERTO','TAREFA_CRIADA','TAREFA_ATUALIZADA',
      'ETAPA_ALTERADA','NEGOCIACAO_CRIADA'].includes(eventoTipo);
    const afirmaConversa=/cliente (?:respondeu|conversou|atendeu)|conversa (?:realizada|confirmada)|ligacao atendida/.test(texto);
    const afirmaEnvioWhats=/whats(?:app)?[^.]{0,60}(?:foi enviado|foi enviada|mensagem enviada|mensagem enviada|enviou)|(?:enviou|enviado)[^.]{0,40}whats/.test(texto);
    const afirmaReuniao=/reuniao (?:foi )?realizada|reuniao aconteceu|cliente compareceu/.test(texto);
    const afirmaRecebimento=/cliente (?:confirmou|acusou) (?:o )?recebimento|proposta (?:foi )?recebida/.test(texto);
    if((origemFraca&&(afirmaConversa||afirmaReuniao||afirmaRecebimento))||
       (eventoTipo==='WHATSAPP_ABERTO'&&afirmaEnvioWhats)||
       (eventoTipo==='EMAIL_ENVIADO'&&(afirmaConversa||afirmaRecebimento))||
       (eventoTipo==='ANOTACAO'&&afirmaReuniao&&
         /(?:nao foi realizada|reuniao cancelada|reuniao desmarcada)/.test(fonteTexto))){
      descartadas++;continue;
    }
    validos.push({criterio:String(f.criterio||'').slice(0,90),
      conclusao:viWidgetSanitizar_(conclusao).slice(0,500),
      referencia:ref,fonte:'RD_UI_HISTORY',tipoEvento:eventoTipo,
      data:String(e.data||''),etapa:String(e.etapaNome||'').slice(0,100),
      agente:viWidgetAgenteEventoIa_(e,leitura),
      confianca:'INDICIO_INTERPRETATIVO_COM_REFERENCIA_RD'});
  }
  return {disponivel:validos.length>0,fatos:validos,
    referenciasDescartadas:descartadas,
    limite:'A IA so interpreta cartoes RD com referencia existente e tipo compativel. Indicio de IA nao e prova, auditoria ou nota de compliance.'};
}

/**
 * Plano SDR por registros documentados da negociacao, nao por todos os
 * registros do lead indistintamente. Sempre devolver 7 pilares + 9 extras
 * com titulo, status, evidencia, janela, autor/data e proxima acao.
 *
 * Quando a etapa avanca, auditar retroativamente as passagens SDR.
 * A etapa "Apresentacao" geralmente representa passagem para closer,
 * mas evidencia nessa etapa nao e atribuida automaticamente ao SDR.
 * Nenhum SLA numerico sera inventado sem versao de playbook homologada.
 */
function viWidgetPlanoSdrHistoricoRd_(leitura,diagnostico) {
  const stage=(leitura.historicoRdEtapas||{});
  const visual=(stage.linhaDoTempo||{});
  const eventos=Array.isArray(visual.eventos)?visual.eventos:[];
  const janelas=Array.isArray(stage.janelas)?stage.janelas:[];
  const deal=leitura.negociacao||{};
  const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
  const nomeStage=x=>normal(x.etapaNome||'');
  const primeiraCloser=janelas.findIndex(j=>
    /apresentacao|reuniao|proposta|negociacao|fechamento|closer/.test(nomeStage(j)));
  const pre=primeiraCloser>=0?janelas.slice(0,primeiraCloser):janelas;
  const ids=new Set(pre.map(j=>String(j.passagemId||'')));
  // Se ainda nao houve closer, a etapa corrente pertence ao percurso SDR,
  // salvo se o nome explicito disser o contrario.
  const sdr=eventos.filter(e=>ids.has(String(e.passagemId||'')));
  const texto=e=>normal(e.texto||'');
  const data=e=>String(e.data||'');
  const ordered=list=>list.slice().sort((a,b)=>data(a).localeCompare(data(b)));
  const ultimo=list=>ordered(list).slice(-1)[0]||null;
  const tipe=(list,type)=>list.filter(e=>e.acao===type);
  const combinar=(list,re)=>list.filter(e=>re.test(texto(e)));
  const anotacoes=tipe(sdr,'ANOTACAO');
  const saidas=tipe(sdr,'TAREFA_CONCLUIDA');
  const criadas=tipe(sdr,'TAREFA_CRIADA');
  const emails=tipe(sdr,'EMAIL_ENVIADO');
  const whatsapp=tipe(sdr,'WHATSAPP_ABERTO');
  // Título de tarefa de ligação não é uma tentativa técnica.
  const ligacoes=combinar(sdr.filter(e=>
    ['OUTRO_VISUAL_RD','LIGACAO_REALIZADA','CHAMADA_REGISTRADA'].includes(e.acao)),
    /(?:atendimento para|ligac(?:ao|oes)|telefonema|chamada telefonica|discagem|voip)/);
  const chamadaVoipRegistrada=ligacoes.find(e=>e.acao==='OUTRO_VISUAL_RD'&&
    /atendimento para|ligacao realizada|chamada efetuada/.test(texto(e)))||null;
  const tentativas=[...ligacoes,...emails,...whatsapp].filter((e,i,arr)=>
    arr.findIndex(x=>x.id===e.id)===i);
  const notasResultado=combinar(anotacoes,
    /(?:nao atendeu|nao respondeu|sem resposta|caixa postal|ocupado|retornou|respondeu|agendou|reagendou|confirmou|sem interesse|desqualificad|conversamos|falei com|falou com|atendeu)/);
  const questoes=combinar(anotacoes,/faturamento|lmv|receita|qualific|dor|necessidade|objetivo|sistema atual|segmento|decisor/);
  const hadCloser=primeiraCloser>=0;
  const boardSdr=Array.isArray(leitura.ligacoesBoard)?leitura.ligacoesBoard.filter(l=>
    l?.data&&String(l.funcaoDeclarada||'').toUpperCase()!=='CLOSER'&&
    (!hadCloser||l.data<janelas[primeiraCloser].inicio)):[];
  const agendaContexto=eventos.filter(e=>
    ids.has(String(e.passagemId||'')) ||
    (hadCloser && String(e.passagemId||'')===String(janelas[primeiraCloser]?.passagemId||'')));
  const notesAgenda=tipe(agendaContexto,'ANOTACAO');
  // O texto do card contém "na etapa Apresentação do funil".
  // Esse sufixo não é evidência de convite ou reunião agendada.
  const somenteDescricao=e=>texto(e).replace(/\bna etapa .+? do funil(?:\s|$)/g,' ');
  const tiposAgenda=new Set(['ANOTACAO','TAREFA_CRIADA','TAREFA_ATUALIZADA',
    'EMAIL_ENVIADO','EMAIL_RESPONDIDO']);
  const agendaNegada=e=>/(?:nao|nunca|sem) (?:foi |esta |tem |houve )?(?:agendad|marcad|confirmad)|(?:reuniao|apresentacao).{0,50}(?:nao|sem|nunca).{0,25}(?:agendad|marcad|confirmad)|aguardando confirmacao|tentando agendar|sem agendamento/.test(somenteDescricao(e));
  const registrosAgenda=agendaContexto.filter(e=>tiposAgenda.has(e.acao) &&
    /(?:reuniao|apresentacao|agendament|agendad|agenda de |demonstracao|convite)/.test(somenteDescricao(e)) &&
    !agendaNegada(e));
  const agendaConfirmada=notesAgenda.filter(e=>
    /reuniao.{0,70}(?:agendad|marcad)|(?:agendamos|marcamos).{0,60}(?:reuniao|apresentacao)|apresentacao.{0,50}agendada/.test(somenteDescricao(e)) &&
    !/reuniao.{0,40}(?:nao|nunca|sem).{0,20}(?:agendad|marcad)|(?:nao|nunca) (?:foi |esta )?(?:agendad|marcad)/.test(somenteDescricao(e)));
  const semConfirmar=/nao (?:foi |esta |est[aá] )?(?:confirmad|agendad)|aguardando confirmacao|tentando confirmar/;
  const respostasConfirmacao=combinar(notesAgenda,
    /(?:cliente|lead|comprador|contato).{0,70}confirmou|confirmou presenca|aceitou o convite/)
    .filter(e=>!semConfirmar.test(texto(e)));
  const noShow=combinar(notesAgenda,
    /no.?show|nao compareceu|faltou (?:a|na) reuniao|nao entrou (?:na|no) reuniao|tinhamos nosso compromisso hoje.{0,110}(?:mas (?:voce nao|nao houve|nao compareceu)|voce nao)/)
    .filter(e=>!/nao houve no.?show|sem no.?show|nao foi no.?show/.test(texto(e)));
  const compromissoDeclarado=combinar(notesAgenda,
    /tinhamos nosso compromisso hoje|nosso encontro hoje|marcamos.{0,55}(?:reuniao|apresentacao)/)
    .filter(e=>!/nao marcamos|sem compromisso marcado/.test(texto(e)));
  const tarefaNoShow=combinar(agendaContexto.filter(e=>
    ['TAREFA_CRIADA','TAREFA_CONCLUIDA','EMAIL_ENVIADO','ANOTACAO'].includes(e.acao)),
    /reagend|recuperacao de agenda|recovery|retomada do contato|tentativa de reagendamento/);
  const repasse=combinar(notesAgenda,
    /(?:passagem de bastao|handoff|encaminhad[oa] ao closer|passei para o closer|closer responsavel|resumo para o closer)/);
  const notaSegmento=combinar(anotacoes,/segmento|setor de atuacao|ramo|tipo de empresa/);
  const notaLmv=combinar(anotacoes,/lmv|faturamento|receita mensal|faixa de receita/);
  const notaDor=combinar(anotacoes,/dor|necessidade|desafio|motivo do contato|objetivo|sistema atual/);
  const notaValor=combinar(anotacoes,/valor da reuniao|beneficio da reuniao|importancia da reuniao|na apresentacao voce vai/);
  const notaHorarios=combinar(notesAgenda,/dois horarios|duas opcoes|duas alternativas|opcao de horario/);

  const tarefas=Array.isArray(leitura.tarefas)?leitura.tarefas:[];
  const nasJanelas=(ts)=> {
    const ms=Date.parse(ts||'');
    return Number.isFinite(ms)&&pre.some(j=>{
      const inicio=Date.parse(j.inicio||'');
      const fim=j.fim?Date.parse(j.fim):Infinity;
      return Number.isFinite(inicio)&&ms>=inicio&&ms<fim;
    });
  };
  const tarefasSdr=tarefas.filter(t=>nasJanelas(t.criadaEm||''));
  const abertas=tarefasSdr.filter(t=>t.concluida!==true);
  const vencidas=abertas.filter(t=>t.previstaPara&&Date.parse(t.previstaPara)<Date.now());
  const foraPrazo=tarefasSdr.filter(t=>t.concluida&&t.concluidaEm&&t.previstaPara&&
    Date.parse(t.concluidaEm)>Date.parse(t.previstaPara));
  const primeiras=ordered(sdr);
  const entrada=String(deal.criadaEm||(stage.cadastroAtual||{}).criadoEm||'');
  const primeiraAposCriacao=primeiras.find(e=>e.acao!=='NEGOCIACAO_CRIADA'&&
    e.acao!=='ETAPA_ALTERADA')||null;
  const minutos=entrada&&primeiraAposCriacao&&
    Number.isFinite(Date.parse(entrada))&&Number.isFinite(Date.parse(primeiraAposCriacao.data))?
    Math.max(0,Math.round((Date.parse(primeiraAposCriacao.data)-Date.parse(entrada))/60000)):null;
  const aplicavel=diagnostico&&diagnostico.ativo===true;
  const itens=[];
  const ref=e=>e?'RD Histórico '+e.id+' · '+(e.dataTexto||e.data||'')+
    (e.autor?' · '+String(e.autor).slice(0,80):'')+
    (e.etapaNome?' · '+String(e.etapaNome).slice(0,70):''):'';
  const detalheEvento=e=>e?viWidgetSanitizar_(e.texto||'').slice(0,260):'';
  const reg=(id,titulo,status,msg,e,acao,pilar)=>{
    const evid=ref(e);
    // Vermelho exige obrigatoriedade homologada e evidencia do desvio.
    // Tarefa vencida ou anotacao ausente nao permite reprovar o SDR.
    let conformidade='PENDENTE';
    if(status==='NAO_APLICAVEL')conformidade='NAO_APLICAVEL';
    else if(status==='INDICIO'&&e){
      const t=texto(e);
      if(id==='voip'&&e.acao==='OUTRO_VISUAL_RD'&&
        /atendimento para|ligacao realizada|chamada efetuada/.test(t))
        conformidade='CONFORME';
      if(id==='segmento'&&e.acao==='ANOTACAO'&&
        /(?:segmento|setor|ramo)(?: de atuacao)?\s*[:=-]\s*[\w\s-]{3,45}/.test(t))
        conformidade='CONFORME';
      if(id==='lmv'&&e.acao==='ANOTACAO'&&
        /(?:lmv|faturamento|receita mensal) (?:validado|confirmado|conferido)\s*[:=-]\s*(?:r\$ ?\d|positivo|negativo|acima|abaixo|entre \d)|(?:cliente|lead) (?:confirmou|validou) (?:o |seu )?(?:lmv|faturamento|receita mensal).{0,45}(?:r\$ ?\d|positivo|negativo|acima|abaixo)/.test(t))
        conformidade='CONFORME';
    }
    itens.push({id,titulo,status,conformidade,detalhe:msg,evidencia:e?
      evid+' · '+detalheEvento(e):'',
      fonte:e?'RD_UI_HISTORY · '+e.id:'RD_UI_HISTORY · '+(pre.map(j=>j.etapaNome).join(' → ')||'etapas em validação'),
      acao,prioridade:conformidade==='NAO_CONFORME'?'ALTA':'MEDIA',
      pilar:pilar||'COMPLEMENTAR',janela:'JORNADA_SDR_ANTES_CLOSER',
      regra:'Verificacao da execucao documentada no RD. SLA/cadencia depende da versao da Wisetec homologada.'});
  };

  const dias=Array.from(new Set(tentativas.filter(e=>e.data).map(e=>e.data.slice(0,10)))).sort();
  const cadenciaRegistrada=tentativas.length>0||saidas.length>0||criadas.length>0;
  reg('cadencia','Uso da cadência e tentativas',
    cadenciaRegistrada?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    sdr.length+' registro(s) nas etapas SDR: '+tentativas.length+' possiveis tentativas por canal ('+
      emails.length+' email enviado, '+whatsapp.length+' WhatsApp Web aberto, '+
      ligacoes.length+' registro(s) relacionados a ligacao); '+criadas.length+
      ' tarefas criadas e '+saidas.length+' concluidas; '+dias.length+
      ' dia(s) com registros de canal. Sem versao vigente da regua nao se pode declarar cadencia integral conforme.',
    ultimo(tentativas)||ultimo(saidas)||ultimo(criadas),
    'Confrontar os dias e canais registrados com a Estrutura da Cadência aplicável, separando início da cadência e recovery.','OFICIAL');
  reg('voip','Uso de ligação nas tentativas',
    ligacoes.length||boardSdr.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    ligacoes.length+' evento(s) de chamada no RD (sem títulos de tarefas) e '+
    boardSdr.length+' chamada(s) técnica(s) do Board antes da etapa Closer. '+
    'Discagem não comprova atendimento; confirmar papel, autoria e desfecho.',
    chamadaVoipRegistrada||ultimo(ligacoes),
    'Conciliar a telefonia efetiva, o resultado de cada chamada e a autoria SDR.','OFICIAL');
  reg('pitch','Aplicação do pitch de qualificação','NAO_VERIFICAVEL',
    'O Histórico RD permite ler anotações e resultados, mas não comprova palavra por palavra a aplicação do pitch SDR.',
    ultimo(questoes),'Conferir o pitch apenas quando existir gravação ou transcrição atribuída ao SDR.','OFICIAL');
  const noShowReal=noShow.length>0;
  const retomadas=noShowReal?tarefaNoShow.filter(e=>data(e)>data(ultimo(noShow))):[];
  reg('no_show','Cadência de recuperação de no-show',
    !noShowReal?'NAO_APLICAVEL':retomadas.length?'INDICIO':'SEM_EVIDENCIA',
    !noShowReal?'Nenhum no-show explícito foi identificado nas anotações do Histórico do RD; não ativar esta cobrança.':
      retomadas.length?'No-show registrado e '+retomadas.length+' ação(ões) posterior(es) relacionadas a retomada, ainda sem validar prazo.':
      'Existe anotação de ausência do comprador, mas não foi localizado registro posterior de retomada ou reagendamento.',
    ultimo(retomadas)||ultimo(noShow),noShowReal?
      'Registrar nova tentativa de reagendamento conforme cadência de no-show, com data e desfecho.':'',
    'OFICIAL');
  reg('handoff','Passagem de bastão SDR → Closer',
    repasse.length?'INDICIO':hadCloser?'SEM_EVIDENCIA':'NAO_APLICAVEL',
    repasse.length?'Há anotação de repasse; conferir se inclui LMV, dor, responsável e reunião.':
      hadCloser?'A negociação avançou para uma etapa de apresentação/reunião, mas não foi encontrada anotação explícita de passagem de bastão.':
      'Ainda não foi identificada a passagem da negociação para uma etapa de closer.',
    ultimo(repasse),'Registrar o contexto qualificado, responsável e compromisso acordado na passagem para o Closer.','OFICIAL');
  reg('registros','Registro do resultado após cada ação',
    notasResultado.length?'INDICIO':(saidas.length||ligacoes.length)?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    notasResultado.length+' anotação(ões) de desfecho antes da fase Closer; '+
      saidas.length+' tarefa(s) concluída(s) visualmente; '+
      boardSdr.length+' chamada(s) técnica(s) do Board e '+ligacoes.length+
      ' evento(s) de telefonia do RD. Essas fontes não formam pares automaticamente.',
    ultimo(notasResultado)||ultimo(saidas),
    'Reconciliar cada tentativa de ligação/contato com o desfecho registrado, sem criar eventos duplicados.','OFICIAL');
  reg('tarefas','Marcação e execução das tarefas no prazo',
    vencidas.length||foraPrazo.length?'ATENCAO':
      tarefasSdr.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    tarefasSdr.length+' tarefa(s) criada(s) antes da etapa Closer; '+
      vencidas.length+' aberta(s) vencida(s) e '+foraPrazo.length+
      ' com conclusão posterior à data prevista (API). Uma conclusão posterior pode ter ocorrido em Agenda/Closer. '+
      'Sem prazos homologados, tratar como revisão operacional e não como reprovação do SDR.',
    ultimo(sdr.filter(e=>e.acao==='TAREFA_CONCLUIDA'||e.acao==='TAREFA_CRIADA')),
    'Revisar datas previstas e efetivas das tarefas com seus responsáveis; justificar e corrigir pendências.','OFICIAL');

  reg('segmento','Segmento identificado antes da agenda',
    notaSegmento.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    notaSegmento.length?'Há anotação sobre setor ou segmento no percurso SDR.':
      'Nenhuma anotação identificável de segmento encontrada nas passagens SDR.',
    ultimo(notaSegmento),'Registrar segmento e perfil do lead no CRM, conforme processo de qualificação.');
  reg('lmv','LMV e faturamento validados no CRM',
    notaLmv.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    notaLmv.length?'Há texto de LMV/faturamento nas anotações; verificar se representa declaração inicial ou validação posterior.':
      'Não há anotação reconhecível de LMV validado nas passagens SDR. Campos atuais não comprovam a data da validação.',
    ultimo(notaLmv),'Registrar o LMV validado, responsável e data da qualificação.');
  reg('qualificacao','Necessidade e motivação registradas',
    notaDor.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    notaDor.length?'Anotação de necessidade, dor ou motivação identificada; verificar profundidade do diagnóstico.':
      'Não há anotação de dor, objetivo ou contexto identificável nas passagens SDR.',
    ultimo(notaDor),'Registrar necessidade, dor, objetivo e motivação do contato.');
  reg('agenda','Agendamento com data e responsável',
    agendaConfirmada.length||registrosAgenda.length||compromissoDeclarado.length||noShow.length?
      'INDICIO':hadCloser?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    agendaConfirmada.length?'Anotação de agendamento identificada; conferir data, Closer e acesso.':
      compromissoDeclarado.length||noShow.length?
      'Há registro de compromisso/no-show na etapa de reunião. Isso é indício de encontro previsto, mas NÃO prova aceite, horário, convite ou handoff.':
      registrosAgenda.length?'Há menção à reunião/agenda, sem confirmação estruturada.':
      hadCloser?'A etapa de apresentação sozinha não prova agendamento. Verificar calendário e comunicação.':
      'Ainda não houve passagem confirmada para reunião.',
    ultimo(agendaConfirmada)||ultimo(compromissoDeclarado)||ultimo(noShow)||ultimo(registrosAgenda),
    'Conciliar o compromisso citado com data/hora, participantes, responsável e convite no calendário.');
  reg('confirmacao','Confirmação de presença do cliente',
    respostasConfirmacao.length?'INDICIO':
      registrosAgenda.length||compromissoDeclarado.length||noShow.length?'NAO_VERIFICAVEL':'NAO_APLICAVEL',
    respostasConfirmacao.length?'Existe anotação atribuindo confirmação ao comprador; conferir data e origem.':
      registrosAgenda.length||compromissoDeclarado.length||noShow.length?
      'O compromisso é mencionado, mas não foi localizada resposta positiva do cliente. A responsabilidade e o prazo ainda precisam ser confirmados.':
      'Não há compromisso confirmado que torne esta verificação aplicável.',
    ultimo(respostasConfirmacao),
    registrosAgenda.length||compromissoDeclarado.length||noShow.length?
      'Verificar confirmação positiva do comprador; convite e lembrete não a substituem.':'');
  reg('valor_reuniao','Valor da reunião explicado no pitch',
    notaValor.length?'INDICIO':'NAO_VERIFICAVEL',
    notaValor.length?'Há anotação sobre benefícios da reunião, mas a fala exata exige áudio/transcrição.':
      'Sem transcrição atribuída ao SDR, não é possível confirmar se explicou os benefícios da reunião.',
    ultimo(notaValor),'Auditar pitch apenas com conteúdo da ligação SDR autenticado.');
  reg('horarios','Oferecimento de duas opções de horário',
    notaHorarios.length?'INDICIO':'NAO_VERIFICAVEL',
    notaHorarios.length?'Há anotação citando alternativas de horários.':
      'Não há texto suficiente para confirmar a oferta de duas opções; verificar gravação quando disponível.',
    ultimo(notaHorarios),'Conferir a oferta de horários no registro da conversa.');
  reg('primeiro_registro','Intervalo até o primeiro registro após entrada',
    minutos!==null?'EVIDENCIADO':'NAO_VERIFICAVEL',
    minutos!==null?minutos+' minuto(s) entre a criação do negócio e o primeiro evento não estrutural. Isso não mede automaticamente tempo até primeiro contato humano.':
      'Criação do negócio e/ou primeiro evento sem data comparável.',
    primeiraAposCriacao,'Calcular SLA de primeiro contato somente usando uma tentativa documentada e o calendário aplicável.');
  reg('resultado_ligacao','Resultado de tentativa de ligação documentado',
    notasResultado.length?'INDICIO':ligacoes.length?'SEM_EVIDENCIA':'NAO_APLICAVEL',
    notasResultado.length?'Existem '+notasResultado.length+' anotações de desfecho (ex.: não atendeu, retorno, conversa).':
      ligacoes.length?'Foram encontrados registros de ligação, mas nenhuma anotação de resultado identificável na jornada SDR.':
      'Não há ligação identificada neste recorte para exigir desfecho.',
    ultimo(notasResultado),'Registrar outcome da chamada ou apontar a anotação existente.');

  const conta={EVIDENCIADO:0,INDICIO:0,ATENCAO:0,SEM_EVIDENCIA:0,
    NAO_VERIFICAVEL:0,NAO_APLICAVEL:0};
  itens.forEach(x=>{conta[x.status]=(conta[x.status]||0)+1;});
  const uteis=Array.from(new Set(sdr.filter(e=>e.data).map(e=>e.data.slice(0,10)))).sort();
  return {titulo:'Plano de Otimização SDR',versao:'RD_HISTORY_STAGE_V1',
    fonte:'RD_UI_HISTORY',coberturaCompleta:aplicavel,clienteReferencia:'Wisetec',
    total:itens.length,oficial:7,complementar:9,itens,contagem:conta,
    escopo:{passagensSdr:pre.map(j=>({id:j.passagemId,nome:j.etapaNome,
      entrada:j.inicio,saida:j.fim})),totalEventosSdr:sdr.length,
      outrosEventos:eventos.length-sdr.length,diasComEventos:uteis,
      eventoInicioCloser:hadCloser?janelas[primeiraCloser].inicio:'',
      regraCadenciaAplicavel:'VERSAO_CLIENTE_NAO_CONFIRMADA'},
    aviso:'Estes critérios analisam os registros anteriores à etapa de apresentação e as evidências de agenda. Sem versão vigente da cadência não atribuem compliance integral.',
    restricoes:['As atribuições SDR/Closer dependem do cadastro de responsáveis da operação.',
      'Conformidade de pitch precisa de gravação/transcrição.',
      'Não equiparar abertura de WhatsApp a mensagem enviada.']};
}


/**
 * Plano operacional Closer: sete itens do Plano de Otimizacao Wisetec.
 * Sem "CONFORME" por simples palavra-chave, pagina de proposta ou tarefa.
 * A exigibilidade comeca quando ha registro da reuniao realizada ou etapa
 * comercial de proposta, nao so por a negociacao estar em Apresentacao.
 */
function viWidgetPlanoCloserHistoricoRd_(leitura,diagnostico) {
  const h=leitura.historicoRdEtapas||{};
  const janelas=h.janelas||[];
  const todos=((h.linhaDoTempo||{}).eventos||[]);
  const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
  const primeira=janelas.findIndex(x=>
    /apresenta|reuniao|demonstrac|proposta|fechamento|negociac/.test(normal(x.etapaNome)));
  const closerIds=new Set(janelas.slice(Math.max(0,primeira)).map(x=>x.passagemId));
  const eventos=primeira<0?[]:todos.filter(x=>closerIds.has(x.passagemId));
  const buscar=(type,re)=>eventos.filter(e=>e.acao===type&&(!re||re.test(normal(e.texto)))).sort((a,b)=>
    String(b.data).localeCompare(String(a.data)))[0]||null;
  const notas=eventos.filter(e=>e.acao==='ANOTACAO');
  const emails=eventos.filter(e=>e.acao==='EMAIL_ENVIADO');
  const notaReuniao=notas.filter(e=>
    /(?:reuniao|apresentacao|demonstracao).{0,50}(?:realizad|concluid|aconteceu)|(?:realizamos|fizemos) (?:a |uma )?(?:reuniao|apresentacao)/.test(normal(e.texto)) &&
    !/(?:nao|nunca|sem) (?:foi )?realizad/.test(normal(e.texto)))[0]||null;
  const propostaAtiva=/proposta|negociac|follow|recovery|recupera/.test(
    normal((leitura.negociacao||{}).etapaAtualNome));
  const devido=propostaAtiva||!!notaReuniao;
  const coberturaVisual=diagnostico&&diagnostico.ativo===true;
  const fontes=leitura.fontes||{};
  const completoArquivo=(fontes.arquivosRd||{}).completo===true;
  const completoTarefa=(fontes.tarefas||{}).completo===true;
  const completoNotas=(fontes.atividades||{}).completo===true;
  const arq=Array.isArray(leitura.arquivosRd)?leitura.arquivosRd:[];
  const pdf=arq.filter(a=>String(a.extensao||'').toLowerCase()==='pdf'&&
    /proposta|orcamento|apresentacao|comercial/i.test(a.nome||''));
  const value=Number((leitura.negociacao||{}).valorInformado);
  const valor=Number.isFinite(value)&&value>0;
  const tarefas=(leitura.tarefas||[]).filter(t=>{
    if(!t.criadaEm)return false;
    const data=Date.parse(t.criadaEm);
    return janelas.slice(Math.max(0,primeira)).some(j=>
      data>=Date.parse(j.inicio)&&(!j.fim||data<Date.parse(j.fim)));
  });
  const follow=tarefas.filter(t=>/(?:follow|retorno|proposta|recovery|acompanhar|pr[oó]xim)/i.test(
    String(t.assunto||'')+' '+String(t.anotacao||'')));
  const acordo=notas.find(e=>
    /(?:combinamos|acordamos|ficou combinado|proxima reuniao|follow.?up)/.test(normal(e.texto))&&
    /(?:dia \d{1,2}|(?:^|\s)\d{1,2}[\/-]\d{1,2}|as \d{1,2}(?:h|:)|\d{1,2}:\d{2})/.test(normal(e.texto)))||null;
  const proximo=follow.find(t=>t.previstaPara&&t.responsaveis?.filter(Boolean).length)||null;
  const formal=emails.find(e=>/proposta|formaliz|orcamento|condicoes comerciais/.test(normal(e.texto)))||null;
  const mencaoGravacao=eventos.find(e=>(e.acao==='ANOTACAO'||e.acao==='EMAIL_ENVIADO')&&
    /gravac|tldv|recording|link da reuniao gravada/.test(normal(e.texto)))||null;
  const urlGravacao=(leitura.atividades||[]).find(a=>a.temLinkGravacao===true&&
    (primeira<0||janelas.slice(Math.max(0,primeira)).some(j=>
      a.data&&Date.parse(a.data)>=Date.parse(j.inicio)&&
      (!j.fim||Date.parse(a.data)<Date.parse(j.fim)))))||null;
  const notaContexto=notas.find(e=>/diagnostico|faturamento|necessidade|dor|objetivo/.test(normal(e.texto)))||null;
  const notaCompleta=notas.find(e=>/diagnostico|necessidade|dor/.test(normal(e.texto))&&
    /entendimento|score|validacao/.test(normal(e.texto))&&
    /fechamento|proximo passo|follow.?up/.test(normal(e.texto)))||null;
  const positivo=notas.find(e=>
    /(?:cliente|comprador|lead|contato).{0,65}(?:confirmou|acusou).{0,30}(?:recebimento|que recebeu|proposta recebida)|(?:confirmou recebimento|recebimento confirmado pelo cliente)/.test(normal(e.texto))&&
    !/nao recebeu|sem confirmacao|aguardando|perguntamos se recebeu|chegou tudo/.test(normal(e.texto))&&
    (!formal||e.data>=formal.data))||null;
  const perguntou=notas.find(e=>
    /(?:recebeu|chegou).{0,40}(?:email|e-mail|proposta)|chegou tudo|confirmar o recebimento/.test(normal(e.texto)))||null;
  const proximasTarefas=follow.filter(t=>!t.concluida);
  const atrasos=follow.filter(t=>t.previstaPara&&
    ((!t.concluida&&Date.parse(t.previstaPara)<Date.now())||
     (t.concluida&&t.concluidaEm&&Date.parse(t.concluidaEm)>Date.parse(t.previstaPara))));
  const reg=(id,titulo,cond,ev,detalhe,acao,fonte)=>{
    let conformidade='PENDENTE';
    if(!devido)conformidade='NAO_APLICAVEL';
    else if(cond==='SIM')conformidade='CONFORME';
    else if(cond==='FALTA')conformidade='NAO_CONFORME';
    const e=ev&&ev.acao?ev:null;
    const prova=e?(e.id+' · '+(e.dataTexto||e.data||'')+' · '+(e.autor||'')+
      ' · '+viWidgetSanitizar_(e.texto||'').slice(0,220)):
      ev&&ev.id?'ID '+String(ev.id)+' · '+String(ev.nome||ev.assunto||'').slice(0,170):'';
    return {id,titulo,conformidade,status:cond==='SIM'?'EVIDENCIADO':
      cond==='FALTA'?'SEM_EVIDENCIA':!devido?'NAO_APLICAVEL':'INDICIO',
      detalhe:devido?detalhe:'Aguardando realização documentada da reunião ou início da etapa de proposta; a obrigação ainda não venceu.',
      evidencia:prova,acao:devido?acao:'',fonte:fonte||'RD · Histórico',pilar:'OFICIAL'};
  };
  const itens=[
    reg('gravacao','Link da gravação da reunião',urlGravacao?'SIM':mencaoGravacao?'PARCIAL':completoNotas&&propostaAtiva?'FALTA':'PARCIAL',
      mencaoGravacao||urlGravacao,
      urlGravacao?'Foi encontrado indicador de link de gravação relacionado a esta etapa. Conferir acesso e destino.':
        mencaoGravacao?'Existe menção textual à gravação, sem URL autenticada.':
        'O link da gravação não foi localizado nos registros acessíveis.',
      'Registrar um link funcional da reunião no e-mail ou anotação.','RD · anotações e e-mail'),
    reg('anotacao','Anotação privada do vendedor',notaCompleta?'PARCIAL':notaContexto?'PARCIAL':completoNotas?'FALTA':'PARCIAL',
      notaCompleta||notaContexto,
      notaCompleta?'A anotação contém seções de diagnóstico, entendimento e fechamento, mas o caráter privado e a completude dos links não são verificáveis aqui.':
        notaContexto?'Existe anotação de contexto, mas faltam seções ou confirmação de privacidade.':
        'Não foi localizada anotação estruturada da reunião.',
      'Completar a anotação do Closer com diagnóstico, entendimento, fechamento, gravação e próximo passo.','RD · anotações'),
    reg('proposta_pdf','PDF da proposta anexado',pdf.length?'SIM':completoArquivo&&propostaAtiva?'FALTA':'PARCIAL',
      pdf[0]||null,
      pdf.length?'PDF localizado no recurso Arquivos do negócio. Confirmar versão, valor e destinatário.':
        completoArquivo&&propostaAtiva?'A etapa de proposta foi iniciada, mas a aba Arquivos foi consultada integralmente sem localizar PDF.':
        'A fonte de arquivos não está integralmente acessível; não é possível reprovar a anexação.',
      'Anexar o PDF de proposta atualizado ao lead.','RD · Arquivos'),
    reg('proximo_passo','Tarefa com data e acordo do próximo passo',
      proximo&&acordo?'SIM':follow.length?'PARCIAL':completoTarefa?'FALTA':'PARCIAL',
      proximo||acordo,
      proximo&&acordo?'Há tarefa datada e acordo anotado. Confirmar se o compromisso corresponde ao comprador.':
        follow.length?'Há tarefa de retorno, mas faltam acordo explícito, data/hora ou responsável.':
        'Nenhuma tarefa de continuidade posterior à reunião foi localizada.',
      'Registrar tarefa com data/hora, responsável e compromisso acordado com o lead.','RD · tarefas/anotações'),
    reg('valores','Valores de proposta',valor?'PARCIAL':propostaAtiva?'FALTA':'PARCIAL',
      null,valor?'Valor comercial positivo registrado no RD, mas não foi possível confrontar com o PDF de proposta.':
        'Não há valor comercial positivo comprovado na negociação para uma oportunidade em proposta.',
      'Preencher os valores no negócio e conferir igualdade com o documento da proposta.','RD · negociação/proposta'),
    reg('recebimento','Confirmação de recebimento da proposta',
      positivo?'SIM':perguntou?'PARCIAL':formal&&completoNotas?'FALTA':'PARCIAL',
      positivo||perguntou,
      positivo?'Anotação atribui confirmação positiva de recebimento ao comprador após formalização.':
        perguntou?'Existe pergunta de confirmação; não equivale a resposta positiva.':
        'Nenhum registro positivo de recebimento identificado após o envio da proposta.',
      'Registrar resposta inequívoca do comprador; não confundir solicitação com confirmação.','RD · anotações/e-mail'),
    reg('followup','Cadência de follow-up do Closer',
      atrasos.length?'FALTA':formal&&follow.length?'PARCIAL':formal&&completoTarefa?'FALTA':'PARCIAL',
      follow[0]||formal,
      atrasos.length?atrasos.length+' tarefa(s) de retorno com atraso comprovado no registro.':
        formal&&follow.length?'Há formalização e tarefa(s) de retorno; ainda falta validar cada passo devido da cadência.':
        'Não foi possível confirmar execução da sequência completa de follow-up, inclusive lembretes e recovery.',
      'Comparar envio, confirmação, agenda, lembretes e desfechos com as datas e canais da cadência vigente.','RD · Histórico/tarefas')
  ];
  return {titulo:'Plano de Otimização Closer',fonte:'RD_UI_HISTORY',total:itens.length,
    itens,aplicavel:devido,escopo:{passagensCloser:janelas.slice(Math.max(0,primeira)).length,
      eventosCloser:eventos.length},aviso:'Verde só quando há comprovação operacional suficiente daquele item. A aderência integral à régua e ao pitch depende de eventos e fontes próprias; falta de acesso não vira vermelho.'};
}
