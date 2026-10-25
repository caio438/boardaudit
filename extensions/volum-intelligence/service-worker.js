const DEAL_URL = /^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
const DEFAULT_VOLUM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/exec';

function dealId(url) {
  const match = String(url || '').match(DEAL_URL);
  return match ? match[1].toLowerCase() : '';
}

async function openDetachedWidget(tabId, url) {
  const id = dealId(url);
  if (!id) return { opened: false, reason: 'NEGOCIACAO_RD_NAO_ABERTA' };
  const saved = await chrome.storage.local.get('volumEndpoint');
  const endpoint = String(saved.volumEndpoint || DEFAULT_VOLUM_ENDPOINT);
  if (!/^https:\/\/script\.google\.com\//i.test(endpoint)) return { opened: false, reason: 'ENDPOINT_NAO_CONFIGURADO' };
  const widgetUrl = new URL(endpoint);
  widgetUrl.searchParams.set('volum_widget', '1');
  widgetUrl.searchParams.set('dealId', id);
  const popup = await chrome.windows.create({
    url: widgetUrl.toString(), type: 'popup', width: 500, height: 820
  });
  return { opened: Boolean(popup && popup.id), windowId: popup && popup.id };
}

chrome.action.onClicked.addListener(tab => {
  openDetachedWidget(tab.id, tab.url).catch(console.warn);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VOLUM_DEAL_ID') {
    const id = dealId(message.url);
    sendResponse({ dealId: id });
    return;
  }
  if (message.type === 'VOLUM_OPEN_PANEL' && sender.tab) {
    openDetachedWidget(sender.tab.id, sender.tab.url).then(sendResponse).catch(() => sendResponse({ opened: false }));
    return true;
  }
});
