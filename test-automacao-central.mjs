import fs from 'node:fs';
import assert from 'node:assert/strict';

const central = fs.readFileSync(new URL('./AutomacaoCentral.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const auditoria = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');

assert.match(central, /function desinstalarAutomacaoCentral19h_\(\)/);
assert.match(central, /function INSTALAR_AUTOMACOES_OPERACIONAIS\(\)/);
assert.match(central, /REMOVER_CENTRAL_19H/);
assert.match(code, /tldvSyncHours:\s*\[6, 10, 12, 14, 16, 18, 20\]/);
assert.match(code, /rdTriggerHour:\s*6/);
assert.match(code, /configurada em 7 horários diários/);
assert.match(code, /ops_restore_automation/);
assert.match(code, /\{ chave: 'ingee', nome: 'INGEE', aliases: \['Sinergia', 'Semeio', 'Semeio CBI', 'Semeio\/CBI', 'CBI'\] \}/);
assert.doesNotMatch(code, /\{ chave: 'sinergia'/);
assert.doesNotMatch(code, /\{ chave: 'semeio_cbi'/);

assert.match(code, /function planejarUnificacaoIngeeSinergiaSemeioCbi\(\)/, 'Dry-run da unificação INGEE não foi implementado.');
assert.match(code, /function executarUnificacaoIngeeSinergiaSemeioCbi\(confirmacao\)/, 'Execução protegida da unificação INGEE não foi implementada.');
assert.match(code, /CONFIRMAR_UNIFICACAO_INGEE/, 'Unificação INGEE não exige confirmação explícita.');
assert.match(code, /BACKUP_UNIFICACAO_INGEE_/, 'Unificação INGEE não cria snapshot dos registros afetados.');
assert.match(code, /APP\.sheets\.tarefasFormalizacoes/, 'Migração INGEE não cobre tarefas de formalização.');
assert.match(code, /APP\.sheets\.reunioesCalendario/, 'Migração INGEE não cobre agenda.');
assert.match(code, /APP\.sheets\.entregasMensais/, 'Migração INGEE não cobre entregas mensais.');
assert.match(code, /unificacaoIngeeResolverConflitosPitch_/, 'Migração INGEE não trata conflito de pitch atual.');
assert.match(code, /unificacaoIngeeGarantirAliases_/, 'Migração INGEE não preserva aliases futuros.');
assert.match(jornada, /lerObjetos_\(APP\.sheets\.identificadoresClientes\)/, 'Agenda não usa identificadores canônicos de cliente.');


assert.match(auditoria, /maxPorExecucao:\s*3/);
assert.match(auditoria, /horarios:\s*\[7, 10, 13, 16, 19\]/);
assert.match(auditoria, /AUTOMACAO_LIGACOES_V3\.horarios\.forEach/);
assert.match(jornada, /everyHours\(2\)/);
assert.doesNotMatch(jornada, /instalarAutomacaoCentral19h_\(\);/);
assert.match(jornada, /FORMALIZACAO_NOTURNA_CONFIG\.handlerDiario/);

console.log('Agendas operacionais independentes validadas: tl;dv, RD, ligações, Agenda e formalizações sem dependência da central das 19h.');
