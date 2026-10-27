# VOLUM Sales Ops V2 — núcleo de dados

## Fonte oficial

O V2 usa somente dados autorizados e disponíveis no CRM. Não acessa conversas particulares do WhatsApp.

A Widget é somente apresentação. O backend organiza, normaliza e audita.

## Contrato central

Cada lead deve gerar um snapshot com:

- tenant e CRM;
- pipelines;
- etapas e ordem;
- etapa atual mapeada para a fase VOLUM;
- usuários, IDs, papéis e equipes;
- responsável atual e histórico de atribuição;
- eventos normalizados;
- cobertura da coleta;
- evidências e origem.

## Fases VOLUM

`LEAD → CADENCIA → CONEXAO → AGENDA → REUNIAO`

A etapa do CRM deve ser mapeada por cliente para uma fase VOLUM. O nome isolado da etapa não é suficiente: o motor considera pipeline, ID, ordem e configuração do cliente.

## Estados de auditoria

- `CUMPRIDO`
- `PARCIAL`
- `NAO_CUMPRIDO`
- `NAO_VERIFICAVEL`
- `NAO_APLICAVEL`
- `CONTRADITORIO`

A ausência de registro não é automaticamente uma falha de execução.

## Próximos módulos

1. coletor RD v1 somente leitura;
2. reconciliação de histórico, tarefas, atividades e anotações;
3. agentes LEAD, CADENCIA, CONEXAO, AGENDA e REUNIAO;
4. Plano SDR e Plano Closer;
5. recovery do Closer;
6. agregado macro do CRM;
7. publicação idempotente no histórico e Board;
8. homologação com leads reais.
