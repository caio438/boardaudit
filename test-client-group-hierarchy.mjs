import fs from 'node:fs';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');
const opsWorkflow = fs.readFileSync(new URL('./.github/workflows/ops-client-groups-sync.yml', import.meta.url), 'utf8');
const repairWorkflow = fs.readFileSync(new URL('./.github/workflows/ops-client-groups-repair-stage1.yml', import.meta.url), 'utf8');

assert.match(code, /\{ chave: 'grupo_eleva', nome: 'Grupo Eleva', tipoCliente: 'GRUPO' \}/);
assert.match(code, /\{ chave: 'buffet_mais', nome: 'Buffet Mais', grupoCliente: 'Grupo Eleva' \}/);
assert.match(code, /\{ chave: 'gestao_festa', nome: 'Gestão Festa', grupoCliente: 'Grupo Eleva' \}/);
assert.match(code, /\{ chave: 'assine_mais', nome: 'Assine Mais', grupoCliente: 'Grupo Eleva' \}/);

assert.match(code, /\{ chave: 'grupo_sinergia', nome: 'Grupo Sinergia', tipoCliente: 'GRUPO' \}/);
assert.match(code, /\{ chave: 'ingee', nome: 'INGEE', aliases: \['Ingee'\], grupoCliente: 'Grupo Sinergia' \}/);
assert.match(code, /\{ chave: 'sinergia', nome: 'Sinergia', grupoCliente: 'Grupo Sinergia' \}/);
assert.match(code, /\{ chave: 'semeio_cbi', nome: 'Semeio\/CBI', aliases: \['Semeio', 'Semeio CBI', 'CBI'\], grupoCliente: 'Grupo Sinergia' \}/);
assert.doesNotMatch(code, /nome: 'INGEE'.*aliases: \[[^\]]*Sinergia[^\]]*\]/);

assert.match(code, /'TIPO_CLIENTE', 'GRUPO_CLIENTE'/);
assert.match(code, /tipoCliente: item\.TIPO_CLIENTE \|\| 'EMPRESA'/);
assert.match(code, /grupoCliente: item\.GRUPO_CLIENTE \|\| ''/);
assert.match(code, /ops_sync_client_groups/);
assert.match(code, /Rotina desativada: INGEE, Sinergia e Semeio\/CBI agora são clientes separados/);

assert.match(jornada, /tipo === 'GRUPO' \? 60 : 70/);
assert.match(jornada, /const normal = jornadaNormalizar_\(regra\.VALOR_NORMALIZADO \|\| valor\)/);
assert.match(jornada, /tituloNormalizado\.split\('grupo ' \+ normal\)\.join\(' '\)/);
assert.match(jornada, /jornadaNormalizar_\(item\.VALOR_NORMALIZADO \|\| item\.VALOR\) !== normal/);
assert.match(jornada, /jornadaNormalizar_\(item\.VALOR_NORMALIZADO \|\| item\.VALOR\) === normal/);
assert.match(jornada, /if \(ordenados\.some\(item => !item\.internoVolum\)\) ordenados = ordenados\.filter\(item => !item\.internoVolum\)/);
assert.match(jornada, /function jornadaResolverAmbiguidadeMesmoGrupo_/);
assert.match(jornada, /múltiplas empresas do grupo no título/);
assert.match(jornada, /tipoIdentificador = .*=== 'GRUPO' \? 'GRUPO' : 'NOME'/);
assert.match(jornada, /function jornadaReconciliarIdentificadoresCatalogo_/);
assert.match(jornada, /function DIAGNOSTICAR_CONFLITOS_GRUPOS_CLIENTES/);
assert.match(jornada, /String\(cliente\.TIPO_CLIENTE \|\| ''\)\.toUpperCase\(\) === 'GRUPO'/);
assert.match(jornada, /versao: '1\.9\.7'/);

assert.match(opsWorkflow, /Ops sync client groups:/);
assert.match(opsWorkflow, /ops_sync_client_groups=1/);
assert.match(opsWorkflow, /DRY_RUN/);
assert.doesNotMatch(opsWorkflow, /REPARAR_CONFLITOS|executarReparo|repair_client_groups/i);

assert.match(code, /ops_repair_client_groups_stage1/);
assert.match(jornada, /REPARAR_CONFLITOS_GRUPOS_CLIENTES_ETAPA1/);
assert.match(jornada, /BACKUP_REPARO_GRUPOS_/);
assert.match(jornada, /limiteParte = 30000/);
assert.match(jornada, /function jornadaAplicarAlteracoesReparoEmLote_/);
assert.match(jornada, /function jornadaRestaurarReparoEmLote_/);
assert.match(jornada, /Reparo etapa 1 incompleto/);
assert.match(jornada, /RESULTADO_JSON = resultadoJson/);
assert.match(repairWorkflow, /Ops repair client groups stage1:/);
assert.match(repairWorkflow, /CONFIRMAR_REPARO_GRUPOS_CLIENTES_ETAPA1/);
assert.match(repairWorkflow, /client-groups-repair-stage1-summary\.json/);

console.log('Hierarquia de clientes validada: grupos separados, filhas independentes, VOLUM como fallback e dry-run disponível.');
