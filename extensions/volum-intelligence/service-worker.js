const DEAL_URL = /^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;

function dealId(url) {
  const match = String(url || '').match(DEAL_URL);
  return match ? match[1].toLowerCase() : '';
}

async function syncPanel(tabId, url) {
  const id = dealId(url);
  await chrome.sidePanel.setOptions({ tabId, path: 'sidebar.html', enabled: Boolean(id) });
  if (id) await chrome.storage.session.set({ ['deal:' + tabId]: id });
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'complete') syncPanel(tabId, change.url || tab.url).catch(console.warn);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  syncPanel(tabId, tab.url).catch(console.warn);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'VOLUM_DEAL_ID') return;
  const id = dealId(message.url);
  if (sender.tab && id) chrome.storage.session.set({ ['deal:' + sender.tab.id]: id });
  sendResponse({ dealId: id });
});