const $=id=>document.getElementById(id);
const DEAL_URL=/^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
let activeDealId='';
async function currentDeal(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const saved=await chrome.storage.local.get('volumEndpoint');
  const match=String(tab&&tab.url||'').match(DEAL_URL);
  return {id:match?match[1].toLowerCase():'',endpoint:saved.volumEndpoint||''};
}
function state(message){$('state').textContent=message;$('state').hidden=false;$('summary').hidden=true;}
async function audit(){
  try{
    const {id,endpoint}=await currentDeal();
    if(!id){activeDealId='';state('Abra uma negociação no RD Station para analisar.');return;}
    if(!endpoint){state('Configure a URL privada da VOLUM nas opções da extensão.');return;}
    const url=new URL(endpoint);
    if(url.protocol!=='https:'||url.hostname!=='script.google.com')throw new Error('URL de Web App inválida.');
    url.searchParams.set('volum_widget','1');
    url.searchParams.set('dealId',id);
    if(activeDealId===id && $('summary').querySelector('iframe'))return;
    activeDealId=id;
    const frame=document.createElement('iframe');
    frame.src=url.toString();
    frame.title='VOLUM Intelligence - negociação RD';
    frame.setAttribute('referrerpolicy','no-referrer');
    // O HTMLService da Google executa o codigo num frame googleusercontent
    // dentro do Web App. Enviar ao frame script.google.com nao alcanca o HTML real.
    // A widget pede o historico diretamente ao sidepanel via window.top.postMessage.
    let historyFromRd=null;
    const pendingReceivers=new Set();
    const relayTo=(target,origin)=>{
      if(!historyFromRd||!target||!origin)return;
      try {target.postMessage({type:'VOLUM_RD_UI_HISTORY',dealId:id,history:historyFromRd},origin);}
      catch(_ignore) {}
    };
    const onHistoryRequest=(event)=>{
      const msg=event&&event.data||{};
      if(msg.type!=='VOLUM_REQUEST_RD_UI_HISTORY'||msg.dealId!==id||!event.source)return;
      // Apenas o HTMLService autenticado hospedado no dominio Google.
      if(!/^https:\/\/(?:[a-z0-9-]+\.)?(?:googleusercontent\.com|script\.google\.com)$/i.test(event.origin||''))return;
      pendingReceivers.add({target:event.source,origin:event.origin});
      relayTo(event.source,event.origin);
    };
    window.addEventListener('message',onHistoryRequest);
    frame.addEventListener('load',()=>{historyFromRd=null;},{once:true});
    // Remove receptores da negociacao anterior na troca de deal.
    if(window.__volumHistoryReceiver)window.removeEventListener('message',window.__volumHistoryReceiver);
    window.__volumHistoryReceiver=onHistoryRequest;
    $('summary').replaceChildren(frame);
    $('state').hidden=true;
    $('summary').hidden=false;
    // A API v1 não materializa todos os cartões que o Histórico nativo mostra.
    // A leitura ocorre somente na aba já aberta, sem escrever no CRM.
    chrome.tabs.sendMessage(tab.id,{type:'VOLUM_READ_RD_HISTORY'},function(history){
      if(chrome.runtime.lastError || !history || history.dealId!==id)return;
      historyFromRd=history;
      pendingReceivers.forEach(item=>relayTo(item.target,item.origin));
    });
  }catch(e){state((e&&e.message)||'Não foi possível abrir a widget. Confira a configuração.');}
}
audit();
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url)audit();});
chrome.tabs.onActivated.addListener(()=>audit());
