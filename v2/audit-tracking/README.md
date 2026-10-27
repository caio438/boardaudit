# VOLUM V2 — Rastreamento de auditorias

Este módulo cria o ledger único de auditorias e o agregado por cliente.

## O que passa a ser mensurável

- quantidade de auditorias por cliente, lead, agente e período;
- score médio, último score e distribuição por status;
- cobertura das evidências;
- critérios pendentes;
- quantidade de planos SDR/Closer;
- planos abertos, concluídos e por status;
- taxa de auditoria com plano;
- clientes e leads prioritários.

O registro é idempotente por `audit_id`. O board antigo não é usado como banco de medição. O V1 permanece ativo e independente; o V2 grava seus próprios resultados.

## Próxima integração

1. persistir cada resultado de agente em `audit_runs`;
2. persistir cada Plano SDR/Closer em `optimization_plans`;
3. recalcular `audit_client_rollups` após cada processamento;
4. expor o agregado pela API V2 para a Widget Chrome;
5. adicionar filtros de cliente, período, agente, pipeline, etapa e responsável.
