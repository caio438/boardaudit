(() => {
  const dealPattern = /\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
  const HISTORY_LIMIT = 30;
  const INLINE_ID = 'volum-intelligence-inline-shell';
  const extract = () => {
    const match = location.href.match(dealPattern);
    if (match) chrome.runtime.sendMessage({ type: 'VOLUM_DEAL_ID', url: location.href });
    return Boolean(match);
  };
  const addButton = () => {
    if (!extract() || document.getElementById('volum-intelligence-trigger')) return;
    const button = document.createElement('button');
    button.id = 'volum-intelligence-trigger';
    button.type = 'button';
    // Marca reduzida da VOLUM: o CTA precisa ocupar pouco espaço no RD sem
    // perder identificação visual. O texto permanece para leitores de tela.
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 18" focusable="false"><path d="M2 2 12 16 22 2"/></svg><span>Auditar</span>';
    button.setAttribute('aria-label', 'Abrir auditoria VOLUM');
    button.style.cssText = [
      'position:fixed','right:18px','bottom:22px','z-index:2147483647',
      'border:0','border-radius:999px','padding:12px 16px',
      'display:flex','align-items:center','gap:7px','background:#161C3D','color:#fff',
      'font:600 13px Arial,sans-serif','box-shadow:0 4px 16px rgba(0,0,0,.24)','cursor:pointer'
    ].join(';');
    const showFailure = message => {
      button.title = message;
      button.style.background = '#8f3154';
      button.querySelector('span').textContent = 'Configurar';
      setTimeout(() => {
        button.style.background = '#161C3D';
        button.querySelector('span').textContent = 'Auditar';
      }, 3600);
    };
    button.addEventListener('click', () => {
      button.disabled=true;
      button.style.opacity='.72';
      chrome.runtime.sendMessage({ type: 'VOLUM_OPEN_PANEL' }, response => {
        button.disabled=false;
        button.style.opacity='1';
        if(chrome.runtime.lastError) return showFailure('A extensão não respondeu. Atualize a aba do RD e tente novamente.');
        if(!response || response.opened!==true){
          const reason=String(response?.reason||'');
          return showFailure(reason==='ENDPOINT_NAO_CONFIGURADO'
            ? 'Configure a URL privada da VOLUM nas opções da extensão.'
            : 'Não foi possível abrir esta negociação. Atualize a aba do RD e tente novamente.');
        }
      });
    });
    document.body.appendChild(button);
  };
  const closeInline = () => {
    const host = document.getElementById(INLINE_ID);
    if (host) {
      if(typeof host.__volumHistoryCleanup==='function')host.__volumHistoryCleanup();
      host.remove();
    }
  };
  const openInline = endpoint => {
    if (!extract() || !/^https:\/\/script\.google\.com\//i.test(String(endpoint || ''))) return;
    const old = document.getElementById(INLINE_ID);
    if (old) { closeInline(); return; }
    const dealId = (location.href.match(dealPattern) || [])[1];
    const url = new URL(endpoint);
    url.searchParams.set('volum_widget', '1');
    url.searchParams.set('dealId', dealId.toLowerCase());
    const historyNonce=crypto.randomUUID().replace(/-/g,'');
    url.searchParams.set('volum_history_nonce',historyNonce);
    const host = document.createElement('section');
    host.id = INLINE_ID;
    host.setAttribute('aria-label', 'VOLUM Intelligence');
    host.style.cssText = [
      'position:fixed','top:0','right:0','bottom:0','z-index:2147483646',
      'width:min(430px,100vw)','margin:0','padding:0','border:0','outline:0',
      'border-radius:0','box-shadow:none','background:#080911','overflow:hidden',
      'resize:horizontal','min-width:320px','max-width:calc(100vw - 24px)'
    ].join(';');
    const controls = document.createElement('div');
    controls.setAttribute('aria-label','Controles da VOLUM');
    controls.style.cssText = 'position:absolute;top:7px;left:7px;z-index:2;display:flex;gap:4px;opacity:.16;transition:opacity .16s;';
    controls.addEventListener('mouseenter',()=>{controls.style.opacity='1';});
    controls.addEventListener('mouseleave',()=>{controls.style.opacity='.16';});
    const control = (label, symbol, action) => {
      const button = document.createElement('button');
      button.type='button'; button.setAttribute('aria-label',label); button.textContent=symbol;
      button.style.cssText='width:24px;height:24px;padding:0;border:0;border-radius:999px;background:#11121ddd;color:#e9e4ff;font:700 16px/1 Arial,sans-serif;cursor:pointer;';
      button.addEventListener('click',action); return button;
    };
    let minimized = false;
    const restore = () => {
      minimized=false; host.style.top='0';host.style.bottom='0';host.style.width='min(430px,100vw)';host.style.height='auto';
      frame.hidden=false; controls.style.opacity='.16';
    };
    const minimize = () => {
      minimized=true;host.style.top='auto';host.style.bottom='18px';host.style.right='18px';host.style.width='52px';host.style.height='52px';
      frame.hidden=true;controls.style.opacity='1';
    };
    controls.appendChild(control('Minimizar VOLUM','−',()=>minimized?restore():minimize()));
    controls.appendChild(control('Fechar VOLUM','×',closeInline));
    controls.addEventListener('dblclick',restore);
    let dragging=false,startX=0,startY=0,startRight=0,startBottom=0;
    controls.addEventListener('pointerdown',event=>{
      if(minimized)return;dragging=true;startX=event.clientX;startY=event.clientY;
      startRight=parseInt(host.style.right||'0',10)||0;startBottom=parseInt(host.style.bottom||'0',10)||0;
      controls.setPointerCapture(event.pointerId);event.preventDefault();
    });
    controls.addEventListener('pointermove',event=>{
      if(!dragging)return;host.style.right=Math.max(0,startRight-(event.clientX-startX))+'px';host.style.bottom=Math.max(0,startBottom-(event.clientY-startY))+'px';host.style.top='auto';
    });
    controls.addEventListener('pointerup',event=>{dragging=false;controls.releasePointerCapture(event.pointerId);});
    const frame = document.createElement('iframe');
    frame.src = url.toString();
    frame.title = 'VOLUM Intelligence';
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.cssText = 'display:block;width:100%;height:100%;margin:0;padding:0;border:0;outline:0;box-shadow:none;background:transparent;';
    host.appendChild(controls);
    host.appendChild(frame);
    document.body.appendChild(host);
    // O painel escuro é um frame inline no RD, não um Chrome sidepanel.
    // Apps Script HTML roda em iframe Google aninhado: a widget solicita
    // o Histórico para window.top; respondemos diretamente ao source real.
    const receivers=new Set();
    let latestHistory=null,reading=false;
    const reply=(r)=>{
      if(!latestHistory||!r||!r.source)return;
      try {r.source.postMessage({
        type:'VOLUM_RD_UI_HISTORY',dealId:dealId.toLowerCase(),
        nonce:historyNonce,
        history:latestHistory
      },r.origin);} catch(_ignore) {}
    };
    // Cache persistente na extensao: por deployment + conta autorizada + deal.
    // Nunca armazena transcricao bruta; limita payload, entradas e TTL.
    const cacheVersion='VOLUM_WIDGET_CACHE_051';
    const cacheTtl=60*60*1000,cacheMaxBytes=450000;
    const deploymentPath=new URL(endpoint).pathname.replace(/[^a-zA-Z0-9_-]/g,'_').slice(-140);
    const indexKey='volumCacheIndex:'+deploymentPath;
    const storageKey=scope=>'volumCache:'+deploymentPath+':'+scope+':'+dealId.toLowerCase();
    const cacheAllowed=msg=>msg&&msg.cacheVersion===cacheVersion&&
      /^[a-f0-9]{32}$/i.test(String(msg.scope||''))&&
      ['GET','PUT','CLEAR'].includes(msg.op);
    const cacheValid=e=>e&&e.cacheVersion===cacheVersion&&
      e.dealId===dealId.toLowerCase()&&Number.isFinite(Number(e.savedAt))&&
      Date.now()>=Number(e.savedAt)&&Date.now()-Number(e.savedAt)<cacheTtl&&
      e.answer?.versao==='0.5.1-RD'&&
      e.answer?.trilhaDadosAgentes?.historicoRd?.completo===true;
    const replyCache=(receiver,msg,entry)=>{
      try{receiver.source.postMessage({
        type:'VOLUM_CACHE_RESPONSE',dealId:dealId.toLowerCase(),
        nonce:historyNonce,scope:msg.scope,
        cacheVersion:cacheVersion,op:msg.op,entry:entry||null
      },receiver.origin);}catch(_ignore){}
    };
    const handleCache=async(receiver,msg)=>{
      if(!cacheAllowed(msg))return;
      const key=storageKey(msg.scope);
      try{
        if(msg.op==='GET'){
          const saved=await chrome.storage.local.get(key);
          const entry=saved[key];
          if(!cacheValid(entry)&&entry)await chrome.storage.local.remove(key);
          replyCache(receiver,msg,cacheValid(entry)?entry:null);
        }else if(msg.op==='CLEAR'){
          await chrome.storage.local.remove(key);
          replyCache(receiver,msg,null);
        }else if(msg.op==='PUT'){
          const entry=msg.entry;
          const raw=JSON.stringify(entry||{});
          if(!cacheValid(entry)||entry.scope!==msg.scope||raw.length>cacheMaxBytes)
            return replyCache(receiver,msg,null);
          const snapshot=await chrome.storage.local.get(indexKey);
          const prior=Array.isArray(snapshot[indexKey])?snapshot[indexKey]:[];
          const sorted=[{key,savedAt:Number(entry.savedAt)},...prior.filter(x=>
            x?.key&&x.key!==key&&Number.isFinite(Number(x.savedAt))&&
            Date.now()-Number(x.savedAt)<cacheTtl)]
            .sort((a,b)=>b.savedAt-a.savedAt);
          const keep=sorted.slice(0,12),remove=sorted.slice(12).map(x=>x.key);
          await chrome.storage.local.set({[key]:entry,[indexKey]:keep});
          if(remove.length)await chrome.storage.local.remove(remove);
        }
      }catch(_ignore){if(msg.op==='GET')replyCache(receiver,msg,null);}
    };
    const refresh=async()=>{
      if(reading)return;
      reading=true;
      try {latestHistory=await readDealEvidence();
        receivers.forEach(reply);
      } catch(error) {
        latestHistory={dealId:dealId.toLowerCase(),events:[],
          coverage:{available:false,complete:false,reason:'FALHA_LEITURA_UI'}};
        receivers.forEach(reply);
      } finally {reading=false;}
    };
    const onRequest=(event)=>{
      const data=event&&event.data||{};
      if(data.dealId!==dealId.toLowerCase() || data.nonce!==historyNonce ||
         !event.source || !host.isConnected)return;
      if(!/^https:\/\/(?:[a-z0-9-]+\.)?(?:googleusercontent\.com|script\.google\.com)$/i.test(event.origin||''))return;
      const receiver={source:event.source,origin:event.origin};
      if(data.type==='VOLUM_CACHE_REQUEST'){
        handleCache(receiver,data);return;
      }
      if(data.type!=='VOLUM_REQUEST_RD_UI_HISTORY')return;
      receivers.add(receiver);
      if(latestHistory && latestHistory.coverage?.complete===true && data.refresh!==true)reply(receiver);
      else refresh();
    };
    window.addEventListener('message',onRequest);
    host.__volumHistoryCleanup=()=>window.removeEventListener('message',onRequest);
    // O painel solicita o Histórico apenas se nao houver cache valido;
    // não abrir a aba Historico do RD sem necessidade.
    // refresh() e invocado sob demanda por VOLUM_REQUEST_RD_UI_HISTORY.
  };
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const dateToIso = value => {
    const match = clean(value).match(/(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+às)?\s+(\d{2}):(\d{2})/);
    if (!match) return '';
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    // O RD exibe o horário local do CRM; conservar o texto e normalizar para UTC apenas no servidor.
    return year + '-' + match[2] + '-' + match[1] + 'T' + match[4] + ':' + match[5] + ':00';
  };
  const kind = text => {
    if (/^Negociação criada/i.test(text)) return 'NEGOCIACAO_CRIADA';
    if (/fez uma anotação/i.test(text)) return 'ANOTACAO';
    if (/criou a tarefa/i.test(text)) return 'TAREFA_CRIADA';
    if (/concluiu a tarefa/i.test(text)) return 'TAREFA_CONCLUIDA';
    if (/atualizou a tarefa/i.test(text)) return 'TAREFA_ATUALIZADA';
    if (/alterou a etapa/i.test(text)) return 'ETAPA_ALTERADA';
    if (/alterou o respons[aá]vel para|alterou respons[aá]vel para/i.test(text)) return 'RESPONSAVEL_ALTERADO';
    // Conversa com duração/resultado é telefonia efetiva. Não confundir
    // com uma tarefa cujo título apenas menciona ligação.
    if (/conversa com .{1,120}(?:resultado:|\d+m\s*\d+s)/i.test(text) ||
        /atendimento para .{1,80}dura[cç][aã]o de/i.test(text)) return 'CHAMADA_REGISTRADA';
    if (/alterou /i.test(text)) return 'ALTERACAO';
    if (/abriu um WhatsApp Web/i.test(text)) return 'WHATSAPP_ABERTO';
    if (/enviou um e-mail/i.test(text)) return 'EMAIL_ENVIADO';
    if (/respondeu um email/i.test(text)) return 'EMAIL_RESPONDIDO';
    return 'OUTRO_VISUAL_RD';
  };
  const findHistoryTab = () =>
    document.querySelector('[aria-controls="dealTabsHistory-panel"]') ||
    document.querySelector('#dealTabsHistory-tab') ||
    Array.from(document.querySelectorAll('[role="tab"], button')).find(node =>
      /^Hist[oó]rico$/i.test(clean(node.textContent)));

  const findTab = label => Array.from(document.querySelectorAll('[role="tab"], button')).find(node =>
    new RegExp('^'+label+'$', 'i').test(clean(node.textContent)));
  const panelForTab = tab => {
    const controls=tab&&tab.getAttribute('aria-controls');
    return (controls&&document.getElementById(controls)) || null;
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
  const readSourceTab = async label => {
    const tab=findTab(label);
    if(!tab)return {available:false,complete:false,reason:'ABA_NAO_LOCALIZADA',text:''};
    const active=document.querySelector('[role="tab"][aria-selected="true"]');
    if(tab!==active){tab.click();await pause(500);}
    const panel=panelForTab(tab);
    const text=clean(panel?.innerText||'');
    if(tab!==active&&active?.isConnected)active.click();
    return {available:Boolean(panel),complete:Boolean(panel&&text),reason:text?'':'PAINEL_VAZIO',text:text.slice(0,60000)};
  };

  const historyCards = panel => panel ?
    Array.from(panel.querySelectorAll('ul[role="list"] > li')) : [];

  // A listagem RD carrega mais cartões por AJAX; um delay fixo de 350ms
  // pode produzir falsa cobertura completa. Aguardamos mudanças reais no DOM.
  const waitHistoryChange = (before, timeoutMs) => new Promise(resolve => {
    let settled = false;
    let observer;
    const finish = (ok) => {
      if(settled)return;
      settled=true;
      if(observer)observer.disconnect();
      clearTimeout(timeout);
      resolve(ok);
    };
    const check = () => {
      const panel = document.querySelector('#dealTabsHistory-panel');
      if(panel&&before(panel))finish(true);
    };
    const timeout=setTimeout(()=>finish(false),timeoutMs);
    observer=new MutationObserver(check);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,
      attributeFilter:['disabled','aria-busy','aria-expanded']});
    check();
  });

  const readHistory = async () => {
    const dealId = (location.href.match(dealPattern) || [])[1];
    if(!dealId)return {dealId:'',events:[],coverage:{available:false,complete:false,reason:'DEAL_NAO_ABERTO'}};
    const active=document.querySelector('[role="tab"][aria-selected="true"]');
    const tab=findHistoryTab();
    let activated=false;
    let panel=document.querySelector('#dealTabsHistory-panel');
    if(tab&&(!panel||historyCards(panel).length===0||tab.getAttribute('aria-selected')!=='true')){
      if(tab!==active) {
        tab.click();
        activated=true;
      }
      await waitHistoryChange(p=>historyCards(p).length>0,4000);
      panel=document.querySelector('#dealTabsHistory-panel');
    }
    if(!panel){
      return {dealId:dealId.toLowerCase(),events:[],
        coverage:{available:false,complete:false,reason:'ABA_HISTORICO_NAO_CARREGOU'}};
    }
    let pages=0, failure='';
    try {
      while(pages<HISTORY_LIMIT){
        const button=Array.from(panel.querySelectorAll('button'))
          .find(node=>clean(node.textContent)==='Ver mais'&&!node.disabled);
        if(!button)break;
        const initial=historyCards(panel).length;
        button.click();
        pages++;
        const changed=await waitHistoryChange(p=>historyCards(p).length>initial,4500);
        if(!changed){failure='PAGINACAO_SEM_NOVOS_CARTOES';break;}
        panel=document.querySelector('#dealTabsHistory-panel')||panel;
      }
      const cards=historyCards(panel);
      const events=cards.map((card,index)=>{
        const text=clean(card.innerText);
        if(!text||/Feche at[eé] 40% mais vendas/i.test(text))return null;
        const timestamps=text.match(/\d{2}\/\d{2}\/\d{2,4}(?:\s+às)?\s+\d{2}:\d{2}/g)||[];
        const dateText=timestamps[timestamps.length-1]||'';
        const author=clean((text.match(/^(.+?)\s+(?:fez uma anota[cç][aã]o|criou a tarefa|concluiu a tarefa|atualizou a tarefa|alterou |abriu um WhatsApp Web|enviou um e-mail|respondeu um e-?mail|Conversa com|conversa com|Atendimento para|atendimento para)/i)||[])[1]);
        const stage=clean((text.match(/na etapa (.+?) do funil/i)||[])[1]);
        return {source:'RD_UI_HISTORY',uiIndex:index,dateText,
          dataLocal:dateToIso(dateText),author,stage,kind:kind(text),
          detail:text.slice(0,6000)};
      }).filter(Boolean);
      const pending=Array.from(panel.querySelectorAll('button'))
        .some(node=>clean(node.textContent)==='Ver mais');
      return {dealId:dealId.toLowerCase(),events,
        coverage:{available:true,complete:!failure&&!pending&&pages<HISTORY_LIMIT,
          pagesLoaded:pages,totalVisual:events.length,origin:'RD_UI_HISTORY',
          reason:failure||(pending?'LIMITE_PAGINAS_OU_CARREGAMENTO':'')}};
    } finally {
      // Consultar o Histórico não deve deixar o usuário em outra aba do RD.
      if(activated&&active&&active.isConnected)active.click();
    }
  };

  // Coleta as mesmas fontes que um operador encontra ao copiar a negociação.
  // A extensão só lê; classificação e plano permanecem no backend privado.
  const readDealEvidence = async () => {
    const history=await readHistory();
    const labels=[['emails','E-mail'],['tasks','Tarefas'],['files','Arquivos'],['proposals','Propostas']];
    const sources={};
    for(const [key,label] of labels)sources[key]=await readSourceTab(label);
    history.sources=sources;
    return history;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'VOLUM_OPEN_INLINE_WIDGET') {
      openInline(message.endpoint);
      sendResponse({ opened: Boolean(document.getElementById(INLINE_ID)) });
      return;
    }
    if (message && message.type === 'VOLUM_CLOSE_INLINE_WIDGET') {
      closeInline(); sendResponse({ closed: true }); return;
    }
    if (message && message.type === 'VOLUM_READ_RD_HISTORY') {
      readHistory().then(sendResponse).catch(error => sendResponse({ dealId: '', events: [], coverage: { available: false, complete: false, reason: 'FALHA_LEITURA_UI', detail: clean(error && error.message) } }));
      return true;
    }
  });
  addButton();
  // Trocar de aba RD geralmente muda query/hash da URL. So trocar de
  // NEGOCIACAO remove o painel; senão perderíamos o cache em memoria.
  let lastDealId=(location.href.match(dealPattern)||[])[1]?.toLowerCase()||'';
  new MutationObserver(() => {
    const newDealId=(location.href.match(dealPattern)||[])[1]?.toLowerCase()||'';
    if(newDealId!==lastDealId){
      lastDealId=newDealId;
      closeInline();
      const button=document.getElementById('volum-intelligence-trigger');
      if(button)button.remove();
    }
    addButton();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
