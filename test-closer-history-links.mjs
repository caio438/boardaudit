import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

assert.match(audit, /\.slice\(-1200\)[\s\S]{0,160}omitirResultado: true/,
  'O histórico deve preservar uma janela ampla e leve.');
assert.match(audit, /temResultado:\s*temResultado/,
  'A listagem leve precisa informar que existe conteúdo para abertura pontual.');
assert.match(audit, /resultadoCompleto:\s*opcoes\.omitirResultado \? ''/,
  'A janela ampliada não pode transportar relatórios completos em massa.');
assert.match(front, /item\.resultado \|\| item\.temResultado/,
  'Auditorias leves devem continuar abrindo pelo histórico.');
assert.match(front, /item\.estadoOperacional \|\| item\.status/,
  'O filtro deve usar o estado operacional exibido.');
assert.match(front, /idsClientesEquivalentesAuditoriaFront_\(idCliente\)\.has\(String\(item\.idCliente/,
  'O histórico deve incluir auditorias ligadas a IDs antigos equivalentes do cliente.');
assert.match(front, /estado\.auditorias = \[resposta\.auditoria\]\.concat/,
  'A auditoria recém-finalizada deve ser mesclada imediatamente ao histórico.');

const inicio = front.indexOf('function idsClientesEquivalentesAuditoriaFront_(');
const fim = front.indexOf('function preencherSelectAuditoriaClientes()', inicio);
assert.ok(inicio > 0 && fim > inicio, 'Helpers de vínculo cliente–reunião ausentes.');
const trecho = front.slice(inicio, fim);
const contexto = {
  estado: {
    clientes: [
      { idCliente: 'CLI-ANTIGO', nomeCliente: 'Ingee' },
      { idCliente: 'CLI-CANONICO', nomeCliente: 'INGEE' },
      { idCliente: 'CLI-OUTRO', nomeCliente: 'Sinergia' }
    ]
  },
  String,
  Set
};
vm.createContext(contexto);
vm.runInContext(trecho, contexto);
assert.equal(contexto.interacaoPertenceAoClienteAuditoriaFront_({ idCliente: 'CLI-ANTIGO' }, 'CLI-CANONICO'), true,
  'IDs duplicados com o mesmo nome exato devem compartilhar as reuniões.');
assert.equal(contexto.interacaoPertenceAoClienteAuditoriaFront_({ idCliente: 'CLI-OUTRO' }, 'CLI-CANONICO'), false,
  'Clientes diferentes nunca podem compartilhar reuniões.');

assert.match(front, /reclassificarInteracao:[\s\S]{0,260}interacaoPertenceAoClienteAuditoriaFront_/,
  'O vínculo antigo equivalente deve ser consolidado ao gerar a auditoria.');
assert.match(front, /Revisar e reenviar ao RD/,
  'Falhas de RD devem voltar para a prévia antes do reenvio manual.');

console.log('OK: histórico Closer, vínculo de reuniões e envio manual ao RD protegidos contra regressão.');
