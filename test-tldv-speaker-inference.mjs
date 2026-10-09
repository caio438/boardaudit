import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const start=code.indexOf('function tldvNormalizarPessoa_('),end=code.indexOf('function tldvReconciliarCloserTranscricoes_(',start);
assert.ok(start>0&&end>start);
const src=code.slice(start,end);
const ctx={String,Array,Object,Math,Number};
vm.createContext(ctx);
vm.runInContext(src,ctx);
const seller='Vinícius Cordeiro';
const script=[
  seller+': Meu nome é Vinícius, eu sou especialista em gestão e responsável pela apresentação do produto e pelo diagnóstico.',
  'Heloisa Coutinho: Quero saber quanto custa e se cabe no meu orçamento.',
  seller+': Vou apresentar o nosso sistema e mostrar a plataforma focada nas suas necessidades.',
  'Heloisa Coutinho: Eu uso planilhas e não tenho interesse num sistema muito caro.',
  seller+': Gostaria de confirmar algumas informações sobre a sua empresa e entender suas necessidades.',
  'Heloisa Coutinho: Eu ainda preciso entender esses planos.',
  seller+': Nosso sistema tem três planos e funciona por assinatura e mensalidade.',
  'Heloisa Coutinho: O plano básico parece interessante.',
  seller+': Vamos apresentar a solução focando nos desafios que você comentou.',
  seller+': Nosso sistema oferece recursos de controle e integração, e eu gostaria de entender melhor quais atividades você executa hoje.',
  seller+': Posso te mostrar a plataforma, demonstrar as funcionalidades e explicar nossa proposta comercial com base nessas informações.',
  'Heloisa Coutinho: Antes preciso ver a proposta.'
].join('\n');
const guessed=ctx.tldvInferirApresentadorComercial_(script);
assert.equal(guessed?.nome,seller,'Apresentador comercial explícito deve ser recuperado.');
assert.equal(guessed?.origem,'APRESENTADOR_DA_TRANSCRICAO_PENDENTE_CANONICO');
assert.equal(ctx.tldvInferirApresentadorComercial_('Vinícius: Bom dia.\nLetícia: Ela precisou remarcar.\nVinícius: Até logo.'),null,'No show não pode ser auditado.');
assert.equal(ctx.tldvInferirApresentadorComercial_('Cliente: Eu gostaria que você me mostrasse o seu sistema e mandasse uma proposta.\nVendedor: Combinado.'),null,'Lead não deve ser confundido com Closer.');
const duo=[
 'Vinícius: Eu sou especialista no nosso produto. Vou apresentar o nosso sistema e entender sua necessidade.',
 'Fernanda: Eu sou especialista no nosso produto. Vou apresentar o nosso sistema e entender sua necessidade.',
 'Vinícius: Nosso sistema e nossa plataforma ajudam sua empresa. Vou mostrar a solução.',
 'Fernanda: Nosso sistema e nossa plataforma ajudam sua empresa. Vou mostrar a solução.',
 'Vinícius: Gostaria de confirmar suas necessidades. Vou apresentar nosso sistema.',
 'Fernanda: Gostaria de confirmar suas necessidades. Vou apresentar nosso sistema.',
 'Vinícius: Nosso sistema funciona com planos de mensalidade.',
 'Fernanda: Nosso sistema funciona com planos de mensalidade.',
 'Vinícius: Vamos apresentar o nosso produto com mais detalhes.',
 'Fernanda: Vamos apresentar o nosso produto com mais detalhes.'
].concat([ // Duas vozes com evidências equivalentes e falas extensas não são atribuíveis com confiança.
 'Vinícius: Nosso sistema permite configurar a plataforma e eu vou te apresentar a solução da empresa com atenção ao seu processo.',
 'Fernanda: Nosso sistema permite configurar a plataforma e eu vou te apresentar a solução da empresa com atenção ao seu processo.',
 'Vinícius: Eu sou especialista nesta solução e gostaria de entender quais informações da empresa estão faltando na operação.',
 'Fernanda: Eu sou especialista nesta solução e gostaria de entender quais informações da empresa estão faltando na operação.'
]).join('\n');
assert.equal(ctx.tldvInferirApresentadorComercial_(duo),null,'Duas identidades comerciais plausíveis devem ser sinalizadas como ambíguas.');
assert.match(code,/inferidosPelaTranscricao: inferidosPelaTranscricao/);
assert.match(code,/if \(identificados >= 8/,'Limitar escritas para evitar timeout.');
assert.match(code,/Validar vínculo no Canônico/);
console.log('OK: apresentador recuperado por evidências; lead, no-show e palestrantes ambíguos rejeitados.');
