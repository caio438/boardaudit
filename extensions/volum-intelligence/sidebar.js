const $ = id => document.getElementById(id);
async function currentDeal() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const saved = await chrome.storage.session.get('deal:' + tab.id);
  return saved['deal:' + tab.id] || '';
}
function render(data) {
  $('state').hidden = true; $('summary').hidden = false;
  $('agent').textContent = data.agenteAtual || 'Não identificado';
  $('status').textContent = String(data.status || 'SEM CLASSIFICAÇÃO').replaceAll('_', ' ');
  $('next').textContent = data.proximaAcao || 'Sem ação recomendada.';
  $('evidence').replaceChildren(...(data.evidencias || []).map(item => {
    const li = document.createElement('li'); li.textContent = [item.data, item.texto].filter(Boolean).join(' — '); return li;
  }));
  $('blocks').replaceChildren(...(data.bloqueiosDeAvanco || []).map(item => {
    const li = document.createElement('li'); li.textContent = item; return li;
  }));
}
async function audit() {
  $('state').hidden = false; $('state').textContent = 'Lendo a negociação…'; $('summary').hidden = true;
  const id = await currentDeal();
  if (!id) { $('state').textContent = 'Abra uma negociação no RD Station para iniciar.'; return; }
  const config = await chrome.storage.managed.get({ endpoint: '', identity: '' });
  if (!config.endpoint || !config.identity) {
    $('state').textContent = 'Aguardando configuração privada da VOLUM.';
    return;
  }
  try {
    const response = await fetch(config.endpoint, { method: 'POST', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ dealId:id, identity:config.identity, usarGemini:true }) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    render(await response.json());
  } catch (error) { $('state').textContent = 'Não foi possível carregar a auditoria privada.'; }
}
$('refresh').addEventListener('click', audit); audit();