const DEAL_URL = /^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;

function dealId(url) {
  const match = String(url || '').match(DEAL_URL);
  return match ? match[1].toLowerCase() : '';
}

async function openInlineWidget(tabId, url) {
  const id = dealId(url);
  if (!id) return { opened: false, reason: 'NEGOCIACAO_RD_NAO_ABERTA' };
  const saved = await chrome.storage.local.get('volumEndpoint');
  const endpoint = String(saved.volumEndpoint || '');
  if (!/^https:\/\/script\.google\.com\//i.test(endpoint)) return { opened: false, reason: 'ENDPOINT_NAO_CONFIGURADO' };
  const result = await chrome.tabs.sendMessage(tabId, { type: 'VOLUM_OPEN_INLINE_WIDGET', endpoint: endpoint });
  return result && result.opened ? { opened: true } : { opened: false, reason: 'CONTEUDO_RD_NAO_DISPONIVEL' };
}

chrome.action.onClicked.addListener(tab => {
  openInlineWidget(tab.id, tab.url).catch(console.warn);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VOLUM_DEAL_ID') {
    const id = dealId(message.url);
    sendResponse({ dealId: id });
    return;
  }
  if (message.type === 'VOLUM_OPEN_PANEL' && sender.tab) {
    openInlineWidget(sender.tab.id, sender.tab.url).then(sendResponse).catch(() => sendResponse({ opened: false, reason: 'FALHA_ABRIR_WIDGET' }));
    return true;
  }
});
