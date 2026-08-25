# Otimizar o feed do JulIA Chat (timeouts em julia-chat-list-feed)

O endpoint que carrega a lista de conversas está estourando o tempo limite de forma intermitente (500 no cliente, 28 erros de statement timeout em 24h) e mesmo os carregamentos bem-sucedidos levam ~3s, sendo ~2s no banco legado externo.

## Causa provável (a confirmar antes de mexer)

O bloco de enriquecimento no banco legado (etapa do CRM da Julia, sessão ativa e campanha) faz varredura pesada:
- a subquery de campanhas lê `campaing_ads` inteira, normalizando telefone com `regexp_replace(...)` antes de filtrar — nenhum índice pode ser usado;
- os joins com `sessions`/`agents` comparam `whatsapp_number::text`, o que também invalida índice;
- as consultas de apoio usam `.limit(5000)`.

## Plano

1. Medir antes de alterar: rodar `EXPLAIN (ANALYZE, BUFFERS)` das 3 queries do feed com um payload real e registrar os tempos por etapa, para confirmar qual delas causa os 57014.
2. Corrigir a query de campanhas: filtrar `campaing_ads` primeiro por `session_id`/telefone bruto e só depois normalizar, eliminando a varredura completa.
3. Criar índices de expressão no banco legado para os predicados realmente usados (telefone normalizado em `campaing_ads`, `sessions.whatsapp_number::text`, `crm_atendimento_cards` por telefone), via script em `scripts/external-db/`.
4. Tornar o enriquecimento tolerante a falha: se a parte legada estourar um tempo limite curto (ex.: 4s), devolver a lista sem os badges de etapa/campanha em vez de responder 500, mantendo o cache stale-while-revalidate já existente.
5. Reduzir custo por requisição: substituir os `.limit(5000)` por consultas restritas às linhas da página atual.
6. Validar: medir novamente `total_ms`/`external_ms` no painel de diagnóstico do JulIA Chat e acompanhar os logs por 24h para confirmar ausência de 57014.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/julia-chat-list-feed/index.ts` (pool do Postgres externo com `statement_timeout = 20000`).
- Índices no banco legado devem ir para `scripts/external-db/` (não são migrations do Supabase).
- Nenhuma mudança de UI; contrato de resposta do feed permanece igual, apenas campos de enriquecimento podem vir vazios em caso de degradação.
