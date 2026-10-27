const DEAL_URL = /^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;

function dealId(url) {
  const match = String(url || '').match(DEAL_URL);
  return match ? match[1].toLowerCase() : '';
}

async function openNativeWidget(tabId, url) {
  const id = dealId(url);
  if (!id) return { opened: false, reason: 'NEGOCIACAO_RD_NAO_ABERTA' };
  if (!chrome.sidePanel || typeof chrome.sidePanel.open !== 'function') {
    return { opened: false, reason: 'CHROME_SIDE_PANEL_INDISPONIVEL' };
  }
  try {
    await chrome.sidePanel.open({ tabId });
    return { opened: true, dealId: id };
  } catch (error) {
    return {
      opened: false,
      reason: 'FALHA_ABRIR_SIDE_PANEL',
      detail: String(error && error.message || '')
    };
  }
}

chrome.action.onClicked.addListener(tab => {
  openNativeWidget(tab.id, tab.url).catch(console.warn);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VOLUM_DEAL_ID') {
    sendResponse({ dealId: dealId(message.url) });
    return;
  }
  if (message.type === 'VOLUM_OPEN_PANEL' && sender.tab) {
    openNativeWidget(sender.tab.id, sender.tab.url)
      .then(sendResponse)
      .catch(() => sendResponse({ opened: false, reason: 'FALHA_ABRIR_WIDGET' }));
    return true;
  }
});
