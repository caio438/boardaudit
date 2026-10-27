# VOLUM Sales Ops V2 Worker

API somente leitura para o CRM na Widget e escrita controlada para os motores do V2.

## Rotas

- `GET /health`
- `GET /v2/clients/:tenantId` — auditorias, planos e agregado do cliente
- `GET /v2/leads/:dealId?tenantId=...` — histórico do lead
- `POST /v2/audits` — grava/atualiza auditoria idempotente
- `POST /v2/plans` — grava/atualiza Plano SDR/Closer

O Worker não coleta conversas privadas. Ele recebe resultados normalizados de fontes autorizadas do CRM e dos motores V2. O endpoint aceita `x-volum-api-key` quando `VOLUM_API_KEY` estiver configurada.

## Configuração

1. Criar o banco D1 `volum-v2`.
2. Substituir o `database_id` no `wrangler.toml` apenas no ambiente seguro.
3. Aplicar as migrations.
4. Configurar `VOLUM_API_KEY`.
5. Publicar o Worker.
6. Apontar a Widget Chrome para a URL do Worker.

O deploy real depende do ID/conta Cloudflare; nenhum segredo é versionado.
