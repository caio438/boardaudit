import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const back = fs.readFileSync(path.join(dir, 'AuditoriaV3.gs'), 'utf8');
const front = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8');

const exigir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };

exigir(code.includes("tarefasFormalizacoes: 'TAREFAS_FORMALIZACOES'"), 'A aba persistente de tarefas não foi configurada.');
exigir(back.includes('function carregarDadosTarefasFormalizacoes()'), 'A carga das tarefas não existe.');
exigir(back.includes('function tarefasFormalizacoesAdicionarMuitas_'), 'A criação inicial das tarefas não está sendo feita em lote.');
exigir(back.includes("audV3Ler_(FORMALIZACAO_REUNIAO.aba)"), 'As tarefas não estão sendo derivadas das formalizações.');
exigir(back.includes("resultado.ajustes_operacionais") && back.includes("resultado.proximos_passos"), 'A extração não cobre ajustes e próximos passos.');
exigir(back.includes("/\\b(caio|thiago)\\b/") && back.includes("/\\b(allafy|alafy|luis|luiz)\\b/"), 'A separação de Sales Ops e Mídia não está preservada.');
exigir(front.includes('data-page="tarefasFormalizacoes"'), 'A nova área não está no menu.');
exigir(front.includes('function atualizarStatusTarefaFormalizacaoFront'), 'A atualização de andamento não está disponível.');
exigir(front.includes("Auditorias não entram nesta lista."), 'A separação entre formalizações e auditorias não está explícita.');

console.log('Tarefas das formalizações validadas: origem isolada, deduplicação, equipes, filtros e andamento persistente.');
