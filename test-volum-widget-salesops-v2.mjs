import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
new Function(source);
const panelScript=panel.match(/<script>([\s\S]+?)<\/script>/);
assert.ok(panelScript,'Painel deve incluir script.');
new Function(panelScript[1]);
assert.ok(panel.includes('data-deal-id="<?= dealId ?>"'));
const context=vm.createContext({Object,Array,String,Number,Date,Boolean,RegExp,Math,Error,Set});
vm.runInContext(source,context);
const dealId='6acc888b98976f0023dc583f';
const base={
  modo:'SOMENTE_LEITURA',dealId,
  negociacao:{nome:'Caso sintético',etapaAtualNome:'Proposta enviada',etapaOrigem:'CONSULTA_ETAPA_RD'},
  fontes:{atividades:{acessivel:true,completo:true},tarefas:{acessivel:true,completo:true}},
  tarefas:[],ligacoesBoard:[],cerebros:[],atividades:[]
};
function analisar(changes={}) {
  const data={...base,...changes};
  return context.viWidgetParecerDeterministico_(data);
}
const semContato=analisar({atividades:[{
  tipo:'note',textoDisponivel:true,data:'2026-10-14T11:00:00Z',
  texto:'Não atendeu. O cliente não retornou.'
}]});
assert.equal(semContato.agenteAtual,'FOLLOW-UP / RECOVERY');
assert.ok(!semContato.status.includes('CONCORRENTE'));
assert.equal(semContato.compliance.find(x=>x.titulo==='Conexão efetiva').status,'SEM_EVIDENCIA');
assert.equal(semContato.criteriosPlanoWisetec.length,7);
assert.equal(semContato.notaCompliance,null);
assert.equal(semContato.criteriosPlanoWisetec.find(x=>x.titulo.includes('PDF')).status,'NAO_VERIFICAVEL');
assert.ok(!semContato.evidencias[0].texto.includes('https://'));
const competitor=analisar({atividades:[{
  tipo:'note',textoDisponivel:true,data:'2026-10-14T11:00:00Z',
  texto:'Cliente fechou com outra empresa.'
}]});
assert.match(competitor.status,/CONCORRENTE/);
const canceled=analisar({atividades:[
  {tipo:'note',textoDisponivel:true,data:'2026-10-14T11:00:00Z',texto:'Reunião cancelada.'},
  {tipo:'note',textoDisponivel:true,data:'2026-10-15T11:00:00Z',texto:'Reunião reagendada para amanhã.'}
]});
assert.notEqual(canceled.status,'REAGENDAMENTO SEM NOVA CONFIRMAÇÃO');
const incomplete=analisar({fontes:{atividades:{acessivel:false},tarefas:{acessivel:false}}});
assert.equal(incomplete.confianca,'BAIXA');
assert.equal(incomplete.notaCompliance,null);
assert.equal(context.viWidgetEtapa_('Contato feito').agente,'CONEXÃO');
assert.equal(context.viWidgetEtapa_('Proposta enviada').agente,'FOLLOW-UP / RECOVERY');
assert.equal(context.viWidgetEtapa_('etapa sem mapeamento').agente,'ETAPA NÃO MAPEADA');
assert.equal(context.viWidgetSanitizar_('Email a@x.com tel 11999998888 https://example.com/t?token=abc').includes('token=abc'),false);
vm.runInContext("function viWidgetEmailSessao_(){return 'hacker@example.com'};function VOLUM_ANALISAR_LEAD(){return {modo:'SOMENTE_LEITURA'}};",context);
assert.throws(()=>context.VOLUM_WIDGET_AUDITAR_NEGOCIACAO(dealId,'crm@govolum.com',{}),/autorizado/);
console.log('Widget Sales Ops V2: testes sintéticos de etapa, concorrente, conexão, closer, confiança, privacidade e controle de acesso passaram.');
