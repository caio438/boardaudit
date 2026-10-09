import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');
const a = html.indexOf('// BEGIN_BOARD_OPERATION_PROGRESS');
const b = html.indexOf('// END_BOARD_OPERATION_PROGRESS', a);
assert.ok(a > 0 && b > a);
const helper = html.slice(a, b + '// END_BOARD_OPERATION_PROGRESS'.length);
const classes = () => {
  const s = new Set();
  return { add: v => s.add(v), remove: v => s.delete(v), contains: v => s.has(v), toggle: (v, on) => on ? s.add(v) : s.delete(v) };
};
const nodes = Object.fromEntries(['boardOperationProgress','boardOperationTitle','boardOperationElapsed','boardOperationStatus','boardOperationTrack','boardOperationSubtitle'].map(id => [id,{ hidden: id === 'boardOperationProgress', textContent: '', classList: classes() }]));
const calls = [];
function runner(handlers = {}) {
  return {
    withSuccessHandler: h => runner({ ...handlers, success: h }),
    withFailureHandler: h => runner({ ...handlers, failure: h }),
    salvar: () => calls.push(handlers),
    continuar: () => calls.push(handlers),
    obterProgressoAuditoriaV3: () => calls.push(handlers)
  };
}
const original = runner();
const timers = new Map();
let next = 0;
const ctx = {
  document: { addEventListener() {}, getElementById: id => nodes[id] },
  google: { script: { run: original } }, Date,
  setTimeout: (fn, ms) => { const id = ++next; timers.set(id,{ fn, ms }); return id; },
  clearTimeout: id => timers.delete(id),
  setInterval: () => ++next, clearInterval() {},
  queueMicrotask: fn => fn(), mostrarToast() {}
};
vm.createContext(ctx);
vm.runInContext(helper + '\nthis.api={start:iniciarCliqueOperacaoBoard_,run:runnerBoardComProgresso_,active:operacoesBoard_};', ctx);
function button(label) {
  const attrs = {};
  return { textContent:label, classList:classes(), getAttribute:k=>attrs[k]??null, setAttribute:(k,v)=>{attrs[k]=v;}, removeAttribute:k=>{delete attrs[k];} };
}
function fire(ms) {
  for (const [id,t] of Array.from(timers)) if (t.ms <= ms) { timers.delete(id); t.fn(); }
}

assert.equal(ctx.api.run(), original, 'Leituras de fundo devem manter o runner original.');
assert.ok((html.match(/runnerBoardComProgresso_\(\)\s*\.withSuccessHandler/g)||[]).length>=80, 'Cobertura de chamadas insuficiente.');
assert.match(html,/instalarProgressoBoard_\(\);/);
assert.match(html,/id="boardOperationProgress"/);
assert.match(html,/role="progressbar"/);
assert.doesNotMatch(helper,/aria-valuenow/, 'Progresso sem percentual real não pode inventar valores.');

const save=button('Salvar');
ctx.api.start(save);
let success=0;
ctx.api.run().withSuccessHandler(()=>success++).withFailureHandler(()=>{}).salvar();
assert.equal(save.classList.contains('board-processing'),true);
assert.equal(save.getAttribute('aria-busy'),'true');
assert.equal(nodes.boardOperationProgress.hidden,false);
assert.equal(ctx.api.active.get(save).pendentes,1);
calls.shift().success({sucesso:true});
assert.equal(success,1);
fire(650);
assert.equal(save.classList.contains('board-processing'),false);
assert.match(nodes.boardOperationStatus.textContent,/Resposta recebida/);
fire(2500);

const fail=button('Publicar RD');
ctx.api.start(fail);
ctx.api.run().withSuccessHandler(()=>{}).withFailureHandler(()=>{}).salvar();
calls.shift().failure(new Error('Falha no RD'));
fire(650);
assert.match(nodes.boardOperationStatus.textContent,/Falha no RD/);
fire(6500);

const chain=button('Gerar plano');
ctx.api.start(chain);
ctx.api.run().withSuccessHandler(()=>{
  ctx.api.run().withSuccessHandler(()=>{}).withFailureHandler(()=>{}).continuar();
}).withFailureHandler(()=>{}).salvar();
calls.shift().success({sucesso:true});
assert.equal(ctx.api.active.get(chain).pendentes,1, 'Processo encadeado precisa continuar ativo.');
calls.shift().success({sucesso:true});
fire(650);
assert.equal(chain.classList.contains('board-processing'),false);
fire(2500);

const denied=button('Sincronizar');
ctx.api.start(denied);
ctx.api.run().withSuccessHandler(()=>{}).withFailureHandler(()=>{}).salvar();
calls.shift().success({sucesso:false,mensagem:'Operação não autorizada'});
fire(650);
assert.match(nodes.boardOperationStatus.textContent,/Operação não autorizada/);

console.log('Barra global testada: chamadas do Apps Script, sucesso, falha, retorno negativo, múltiplas etapas e leituras de fundo.');
