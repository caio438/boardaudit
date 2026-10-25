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
  const buscar=(list,re)=>ultimaDe(list.filter(e=>re.test(e.normal)));
  const nNegada=/nao (?:foi |esta |est[aá] )?(?:agendad|confirmad|enviad|realizad)|tentando agendar|procurando agendar|aguardando confirmacao|sem confirmacao/;
  const agenda=buscar(notas.filter(e=>!nNegada.test(e.normal)),
    /(?:reuniao|apresentacao|demonstracao|encontro).{0,65}(?:agendad|marcad|confirmad)|(?:agendamos|marcamos).{0,40}(?:reuniao|apresentacao|encontro)|reuniao.{0,30}\d{1,2}\/\d{1,2}/);
  const convite=buscar(enviados,/convite|agenda|reuniao|apresentacao|meet\.google|lembrete/)||
    buscar(notas,/convite enviado|te enviei o convite|convite no seu email/);
  const lembrete=buscar(enviados,/lembrete|nossa reuniao|nosso compromisso/)||
    buscar(notas,/lembrando.{0,70}(?:compromisso|reuniao|encontro)|logo vamos comecar nosso compromisso/);
  const confirmacao=buscar(notas.filter(e=>!nNegada.test(e.normal)),
    /(?:cliente|lead|contato|comprador).{0,70}confirmou.{0,35}(?:presenca|participacao|convite)|(?:confirmou presenca|confirmou o convite|aceitou o convite)/);
  const realizada=buscar(notas.filter(e=>!/nao (?:foi )?realizad/.test(e.normal)),
    /(?:reuniao|apresentacao|demonstracao).{0,45}(?:realizada|aconteceu|concluida)|(?:realizamos|fizemos) (?:a |uma )?(?:reuniao|apresentacao)/);
  const propostaEmail=buscar(enviados,/proposta|formaliz|orcamento|condicoes comerciais/);
  const propostaAnotada=buscar(notas,/enviei.{0,50}proposta|proposta.{0,40}(?:enviada|encaminhada)/);
  const gravacao=buscar(notas.concat(enviados),/gravac|recording|tldv|link da reuniao gravada/);
  const recebimento=buscar(notas.filter(e=>
    !/chegou tudo|voce recebeu|recebeu a proposta\?|consegue confirmar|aguardando.{0,20}recebimento|nao recebeu/.test(e.normal)),
    /(?:cliente|comprador|lead|contato).{0,70}(?:confirmou|acusou).{0,30}(?:recebimento|que recebeu)|(?:ele|ela).{0,25}confirmou.{0,20}recebimento/);
  const recovery=buscar(criadas,/recovery|recupera|retomad/)||
    buscar(notas,/iniciar recovery|inicio de recovery/);
  const follow=buscar(criadas,/follow|retorno|acompanhamento|recuperacao/);
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
      criterioConclusao:'Registro correspondente identificado no Histórico do RD, com data e responsável.',
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
    adicionar('agendamento','Reunião agendada',''+(agenda?'INDICIO':'SEM_REGISTRO'),agenda,
      agenda?'Existe anotação de reunião agendada no Histórico. O convite e a presença exigem provas próprias.':
        'A negociação está em Apresentação, mas não há anotação identificável de data e horário do encontro no Histórico completo.',
      'Registrar ou localizar data, horário, participantes e link do compromisso.','ALTA');
    adicionar('convite','Convite e acesso à reunião',convite?(convite.tipo==='EMAIL_ENVIADO'?'EVIDENCIADO':'INDICIO'):'SEM_REGISTRO',convite,
      convite?'Há registro de convite, lembrete ou instruções; conferir se inclui o acesso correto.':
        'O Histórico completo não apresenta e-mail de convite identificado nem anotação explícita de seu envio.',
      'Registrar convite enviado, destinatários, horário e link de acesso.','ALTA');
    adicionar('confirmacao','Confirmação do participante',confirmacao?'INDICIO':agenda?'SEM_REGISTRO':'NAO_VERIFICAVEL',confirmacao,
      confirmacao?'Anotação indica confirmação; conferir o teor e quem confirmou.':
        agenda?'O agendamento consta, mas não foi encontrada confirmação positiva de presença do comprador.':
        'Sem data de reunião evidenciada, não é possível medir a confirmação exigida.',
      agenda?'Obter e registrar a confirmação do cliente antes do compromisso.':'', 'MÉDIA');
    adicionar('lembrete','Lembrete pré-reunião',lembrete?(lembrete.tipo==='EMAIL_ENVIADO'?'EVIDENCIADO':'INDICIO'):agenda?'SEM_REGISTRO':'NAO_VERIFICAVEL',lembrete,
      lembrete?'Há envio de e-mail ou anotação de lembrete; verificar antecedência exigida na régua.':
        agenda?'Não foi encontrado lembrete no Histórico completo; conferir quando era devido.':
        'Não há compromisso datado para avaliar antecedência do lembrete.',
      agenda?'Verificar prazo e registrar o lembrete previsto na régua de Agenda.':'','MÉDIA');
    adicionar('realizacao','Resultado da reunião',realizada?'INDICIO':'NAO_VERIFICAVEL',realizada,
      realizada?'Uma anotação registra a realização; a etapa, sozinha, não confirma quem participou.':
        'Não foi encontrado relato explícito de reunião realizada; a data do encontro e seu resultado ainda precisam ser confirmados.',
      '', 'MÉDIA');
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
