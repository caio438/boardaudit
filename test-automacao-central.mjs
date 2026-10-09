import fs from 'node:fs';
import assert from 'node:assert/strict';

const central = fs.readFileSync(new URL('./AutomacaoCentral.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const auditoria = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');

assert.match(central, /function desinstalarAutomacaoCentral19h_\(\)/);
assert.match(central, /function INSTALAR_AUTOMACOES_OPERACIONAIS\(\)/);
assert.match(central, /REMOVER_CENTRAL_19H/);
assert.match(code, /const BOARD_MODE = 'MANUAL';/, 'Board precisa iniciar em modo manual.');
assert.match(code, /function DESLIGAR_TODAS_AUTOMACOES_BOARD\(\)/, 'Rotina de desligamento global ausente.');
assert.match(code, /ops_disable_all_automation/, 'Endpoint autenticado para desligar automacoes ausente.');
assert.match(central, /boardModoManual_\(\)/, 'Automacao central nao respeita BOARD_MODE.');
assert.match(auditoria, /BOARD_MODE=MANUAL: automação pausada|boardModoManual_\(\)/, 'Automacao de ligacoes nao respeita BOARD_MODE.');
assert.match(jornada, /boardModoManual_\(\)/, 'Jornada nao respeita BOARD_MODE.');
assert.match(code, /ScriptApp\.newTrigger\(handler\)\.timeBased\(\)\.everyHours\(2\)\.create\(\)/);
assert.match(code, /rdTriggerHour:\s*6/);
assert.match(code, /const agendaTldv = instalarAutomacaoTldv\(\)/);
assert.match(code, /ops_restore_automation/);
assert.match(code, /\{ chave: 'grupo_eleva', nome: 'Grupo Eleva', tipoCliente: 'GRUPO' \}/);
assert.match(code, /\{ chave: 'grupo_sinergia', nome: 'Grupo Sinergia', tipoCliente: 'GRUPO' \}/);
assert.match(code, /\{ chave: 'ingee', nome: 'INGEE', aliases: \['Ingee'\], grupoCliente: 'Grupo Sinergia' \}/);
assert.match(code, /\{ chave: 'sinergia', nome: 'Sinergia', grupoCliente: 'Grupo Sinergia' \}/);
assert.match(code, /\{ chave: 'semeio_cbi', nome: 'Semeio\/CBI'.*grupoCliente: 'Grupo Sinergia' \}/);
assert.doesNotMatch(code, /nome: 'INGEE'.*aliases: \[[^\]]*Sinergia[^\]]*\]/);

assert.match(code, /function executarUnificacaoIngeeSinergiaSemeioCbi\(confirmacao\)/, 'Rotina legada da unificação precisa continuar identificável para bloqueio explícito.');
assert.match(code, /Rotina desativada: INGEE, Sinergia e Semeio\/CBI agora são clientes separados/, 'A unificação legada precisa permanecer bloqueada.');
assert.match(jornada, /function DIAGNOSTICAR_CONFLITOS_GRUPOS_CLIENTES\(\)/, 'Novo dry-run da hierarquia de grupos não foi implementado.');
assert.match(jornada, /function jornadaReconciliarIdentificadoresCatalogo_\(\)/, 'Reconciliação de identificadores de grupo não foi implementada.');
assert.match(jornada, /lerObjetos_\(APP\.sheets\.identificadoresClientes\)/, 'Agenda não usa identificadores canônicos de cliente.');


assert.match(auditoria, /maxPorExecucao:\s*3/);
assert.match(auditoria, /horarios:\s*\[7, 10, 13, 16, 19\]/);
assert.match(auditoria, /AUTOMACAO_LIGACOES_V3\.horarios\.forEach/);
assert.match(jornada, /everyHours\(2\)/);
assert.doesNotMatch(jornada, /instalarAutomacaoCentral19h_\(\);/);
assert.match(jornada, /FORMALIZACAO_NOTURNA_CONFIG\.handlerDiario/);

console.log('Agendas operacionais independentes validadas: tl;dv, RD, ligações, Agenda e formalizações sem dependência da central das 19h.');
