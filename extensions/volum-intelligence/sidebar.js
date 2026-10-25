const $=id=>document.getElementById(id);
const DEAL_URL=/^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
const DEFAULT_VOLUM_ENDPOINT='https://script.google.com/macros/s/AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/exec';
let activeDealId='';
async function currentDeal(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const saved=await chrome.storage.local.get('volumEndpoint');
  const match=String(tab&&tab.url||'').match(DEAL_URL);
  return {id:match?match[1].toLowerCase():'',endpoint:saved.volumEndpoint||DEFAULT_VOLUM_ENDPOINT,tabId:tab&&tab.id};
}
function state(message){$('state').textContent=message;$('state').hidden=false;$('summary').hidden=true;}
async function audit(){
  try{
    const {id,endpoint,tabId}=await currentDeal();
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
    let frameLoaded=false,historyFromRd=null;
    const deliverHistory=()=>{
      if(frameLoaded&&historyFromRd)frame.contentWindow.postMessage({type:'VOLUM_RD_UI_HISTORY',dealId:id,history:historyFromRd},url.origin);
    };
    frame.addEventListener('load',()=>{frameLoaded=true;deliverHistory();},{once:true});
    $('summary').replaceChildren(frame);
    $('state').hidden=true;
    $('summary').hidden=false;
    // A API v1 não materializa todos os cartões que o Histórico nativo mostra.
    // A leitura ocorre somente na aba já aberta, sem escrever no CRM.
    chrome.tabs.sendMessage(tabId,{type:'VOLUM_READ_RD_HISTORY'},function(history){
      if(chrome.runtime.lastError || !history || history.dealId!==id)return;
      historyFromRd=history;deliverHistory();
    });
  }catch(e){state((e&&e.message)||'Não foi possível abrir a widget. Confira a configuração.');}
}
audit();
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url)audit();});
chrome.tabs.onActivated.addListener(()=>audit());
