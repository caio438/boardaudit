import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, normalizarTextoComparacao_: normalize };
vm.createContext(context);
vm.runInContext(source + '\nthis.ownerApi={resolve:audRdResponsavel_,usesGroupOwner:audRdUsaResponsavelGrupoSinergia_,publicName:audRdNomeResponsavelPublico_};', context);

const users = [
  { id: 'USR-SINERGIA', name: 'Sinergia Engenharia', email: 'sinergia@example.com' },
  { id: 'USR-JOAO', name: 'João', email: 'joao@example.com' }
];
context.audRdUsuarios_ = () => users;

const groupIds = [
  'CLI-20260806105306-25F3490A',
  'CLI-20260806112340-E575DA0D',
  'CLI_VOL_SEMEIO_CBI'
];
for (const idCliente of groupIds) {
  for (const tipo of ['SDR', 'CLOSER']) {
    const auditoria = { ID_CLIENTE: idCliente, TIPO_AUDITORIA: tipo };
    assert.equal(context.ownerApi.usesGroupOwner(auditoria), true);
    const owner = context.ownerApi.resolve('token', { COLABORADOR: 'João' }, {}, auditoria);
    assert.equal(owner.id, 'USR-SINERGIA', `${idCliente}/${tipo} não foi atribuído ao usuário compartilhado.`);
    assert.equal(owner.nome, 'Sinergia Engenharia');
    assert.equal(context.ownerApi.publicName({ a: auditoria, i: { COLABORADOR: 'João' }, sdr: owner }), 'Sinergia Engenharia');
  }
}

assert.equal(context.ownerApi.usesGroupOwner({ ID_CLIENTE: 'CLI-OUTRO', TIPO_AUDITORIA: 'SDR' }), false);
const ownerOther = context.ownerApi.resolve('token', { COLABORADOR: 'João' }, {}, { ID_CLIENTE: 'CLI-OUTRO', TIPO_AUDITORIA: 'SDR' });
assert.equal(ownerOther.id, 'USR-JOAO', 'Clientes fora do Grupo Sinergia devem preservar o responsável original.');

console.log('Responsável RD do Grupo Sinergia validado para INGEE, Sinergia e Semeio em SDR e Closer.');
