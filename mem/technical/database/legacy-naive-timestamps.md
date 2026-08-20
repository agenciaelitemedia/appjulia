---
name: Timestamps do banco legado em horário de Brasília
description: Colunas de data das tabelas legadas (crm_atendimento_*) são naive em BRT — nunca gravar ISO UTC
type: constraint
---
As tabelas do Postgres externo legado (ex.: `crm_atendimento_cards`, `crm_atendimento_history`) usam `timestamp without time zone` **contendo horário de Brasília** (padrão do n8n/JulIA).

Regras:
- No frontend, gravar com `nowDbTimestamp()` de `src/lib/dateUtils.ts` (formato `YYYY-MM-DD HH:mm:ss` em `America/Sao_Paulo`). **Nunca** `new Date().toISOString()` (UTC → 3h adiantado).
- `db-query` normaliza automaticamente valores ISO com `Z` para BRT naive nas tabelas de `NAIVE_BRT_TABLES` (insert/update genéricos).
- `parseDbTimestamp` tem proteção: timestamp mais de 2h no futuro é tratado como UTC e recebe -3h.
- **Why:** valores UTC e BRT na mesma coluna faziam o card exibir horários em fusos diferentes e quebravam as janelas de 10 min de Notificações e Alertas.
