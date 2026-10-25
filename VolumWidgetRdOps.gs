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
  const convite=buscar(enviados,/convite|agenda|reuniao|apresentacao|meet\.google|lembrete/)||
    buscar(notas,/convite enviado|te enviei o convite|convite no seu email/);
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

function viWidgetValidarInterpretacaoRd_(interpretacao,leitura) {
  if(!interpretacao || interpretacao.disponivel===false)return {disponivel:false,motivo:'IA_INDISPONIVEL'};
  const ids=new Set((((leitura.historicoRdEtapas||{}).linhaDoTempo||{}).eventos||[])
    .map(e=>String(e.id||'')));
  const refs=Array.isArray(interpretacao.fatos)?interpretacao.fatos:[];
  const fatos=refs.filter(f=>ids.has(String(f.referencia||f.ref||'')) &&
      String(f.conclusao||'').trim())
    .slice(0,7).map(f=>({criterio:String(f.criterio||'').slice(0,90),
      conclusao:viWidgetSanitizar_(f.conclusao).slice(0,500),
      referencia:String(f.referencia||f.ref),fonte:'RD_UI_HISTORY',
      confianca:'ANALISE_IA_SOBRE_EVENTO_VERIFICADO'}));
  return {disponivel:fatos.length>0,fatos,
    limite:'Análise interpretativa: o vínculo da referência com o registro existe, mas a conclusão ainda exige crítica do Sales Ops.'};
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
  const ligacoes=combinar(sdr,/(?:atendimento para|ligac(?:ao|oes)|telefonema|chamada telefonica|discagem|voip)/);
  const tentativas=[...ligacoes,...emails,...whatsapp].filter((e,i,arr)=>
    arr.findIndex(x=>x.id===e.id)===i);
  const notasResultado=combinar(anotacoes,
    /(?:nao atendeu|nao respondeu|sem resposta|caixa postal|ocupado|retornou|respondeu|agendou|reagendou|confirmou|sem interesse|desqualificad|conversamos|falei com|falou com|atendeu)/);
  const questoes=combinar(anotacoes,/faturamento|lmv|receita|qualific|dor|necessidade|objetivo|sistema atual|segmento|decisor/);
  const hadCloser=primeiraCloser>=0;
  const agendaContexto=eventos.filter(e=>
    ids.has(String(e.passagemId||'')) ||
    (hadCloser && String(e.passagemId||'')===String(janelas[primeiraCloser]?.passagemId||'')));
  const notesAgenda=tipe(agendaContexto,'ANOTACAO');
  const registrosAgenda=combinar(agendaContexto,
    /reuniao|apresentacao|agendament|agenda|demonstracao|convite/);
  const agendaConfirmada=combinar(notesAgenda,
    /reuniao.{0,70}(?:agendad|marcad)|(?:agendamos|marcamos).{0,60}(?:reuniao|apresentacao)|apresentacao.{0,50}agendada/);
  const semConfirmar=/nao (?:foi |esta |est[aá] )?(?:confirmad|agendad)|aguardando confirmacao|tentando confirmar/;
  const respostasConfirmacao=combinar(notesAgenda,
    /(?:cliente|lead|comprador|contato).{0,70}confirmou|confirmou presenca|aceitou o convite/)
    .filter(e=>!semConfirmar.test(texto(e)));
  const noShow=combinar(notesAgenda,
    /no.?show|nao compareceu|faltou (?:a|na) reuniao|nao entrou (?:na|no) reuniao/);
  const tarefaNoShow=combinar(agendaContexto,/no.?show|reagend|recuperacao de agenda/);
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
    itens.push({id,titulo,status,detalhe:msg,evidencia:e?
      evid+' · '+detalheEvento(e):'',
      fonte:e?'RD_UI_HISTORY · '+e.id:'RD_UI_HISTORY · '+(pre.map(j=>j.etapaNome).join(' → ')||'etapas em validação'),
      acao,prioridade:status==='ATENCAO'?'ALTA':'MEDIA',
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
    ligacoes.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    ligacoes.length+' registro(s) mencionam ligação ou atendimento no Histórico RD. Tarefa ou duração não comprova conversa; analisar seu resultado documentado.',
    ultimo(ligacoes),'Relacionar cada ligação registrada ao resultado da tentativa no CRM.','OFICIAL');
  reg('pitch','Aplicação do pitch de qualificação','NAO_VERIFICAVEL',
    'O Histórico RD permite ler anotações e resultados, mas não comprova palavra por palavra a aplicação do pitch SDR.',
    ultimo(questoes),'Conferir o pitch apenas quando existir gravação ou transcrição atribuída ao SDR.','OFICIAL');
  const noShowReal=noShow.length>0;
  const retomadas=noShowReal?tarefaNoShow.filter(e=>data(e)>=data(ultimo(noShow))):[];
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
    notasResultado.length+' anotação(ões) de desfecho localizadas para '+saidas.length+
      ' tarefa(s) concluída(s) e '+ligacoes.length+
      ' registro(s) de ligação. Uma nota pode cobrir várias tentativas; não há correspondência um a um demonstrada.',
    ultimo(notasResultado)||ultimo(saidas),
    'Reconciliar cada tentativa de ligação/contato com o desfecho registrado, sem criar eventos duplicados.','OFICIAL');
  reg('tarefas','Marcação e execução das tarefas no prazo',
    vencidas.length||foraPrazo.length?'ATENCAO':
      tarefasSdr.length?'INDICIO':sdr.length?'SEM_EVIDENCIA':'NAO_VERIFICAVEL',
    tarefasSdr.length+' tarefa(s) criada(s) enquanto a negociação estava na jornada SDR; '+
      vencidas.length+' aberta(s) vencida(s) e '+foraPrazo.length+
      ' concluída(s) após data prevista. Não atribuir autoria SDR apenas pelo nome da tarefa.',
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
    agendaConfirmada.length?'INDICIO':registrosAgenda.length?'INDICIO':hadCloser?'SEM_EVIDENCIA':'NAO_APLICAVEL',
    agendaConfirmada.length?'Registro de agendamento identificado; verificar data, responsável e canal.':
      registrosAgenda.length?'Há menção à reunião/agenda, mas o compromisso com data e horário precisa ser comprovado.':
      hadCloser?'O negócio avançou para apresentação, mas não há evidência textual identificável do agendamento anterior.':
      'Ainda não houve passagem confirmada para reunião.',
    ultimo(agendaConfirmada)||ultimo(registrosAgenda),
    'Localizar convite, data, horário e responsável no Histórico do RD.');
  reg('confirmacao','Confirmação de presença do cliente',
    respostasConfirmacao.length?'INDICIO':registrosAgenda.length?'SEM_EVIDENCIA':'NAO_APLICAVEL',
    respostasConfirmacao.length?'Existe anotação atribuindo confirmação ao comprador; conferir data e origem.':
      registrosAgenda.length?'Agendamento mencionado, mas não foi encontrada confirmação explícita de presença do cliente.':
      'Não há agendamento documentado que torne esta verificação aplicável.',
    ultimo(respostasConfirmacao),
    registrosAgenda.length?'Registrar confirmação recebida pelo cliente, não apenas convite ou pergunta de confirmação.':'');
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
