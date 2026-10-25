/**
 * Ponte privada da widget. Publique como Web App restrita às contas VOLUM,
 * executando como usuário que acessa. Nunca habilitar acesso anônimo.
 */
function doGet(e) {
  const email = viWidgetEmailSessao_();
  viWidgetExigirEmail_(email);
  const dealId = viLeadId_((e && e.parameter && e.parameter.dealId) || '');
  const template = HtmlService.createTemplateFromFile('VolumWidgetPanel');
  template.dealId = dealId;
  return template.evaluate().setTitle('VOLUM Intelligence').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function VOLUM_WIDGET_AUDITAR_SESSAO(dealId, usarGemini) {
  const email = viWidgetEmailSessao_();
  return VOLUM_WIDGET_AUDITAR_NEGOCIACAO(dealId, email, { usarGemini: usarGemini === true });
}
function viWidgetEmailSessao_() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}
function viWidgetExigirEmail_(email) {
  if (!email) throw new Error('Nao foi possivel identificar a conta Google. Use uma conta VOLUM autorizada.');
  if (VOLUM_WIDGET.emailsAutorizados.indexOf(email) < 0) throw new Error('Acesso privado nao autorizado para esta widget.');
}