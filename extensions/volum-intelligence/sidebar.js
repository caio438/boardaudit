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
    $('summary').replaceChildren(frame);
    $('state').hidden=true;
    $('summary').hidden=false;
  }catch(e){state((e&&e.message)||'Não foi possível abrir a widget. Confira a configuração.');}
}
audit();
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url)audit();});
chrome.tabs.onActivated.addListener(()=>audit());
