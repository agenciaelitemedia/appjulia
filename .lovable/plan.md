# Integração Julia ↔ Tramitação Inteligente (Planilha)

Verifiquei a API com a chave enviada: base `https://planilha.tramitacaointeligente.com.br/api/v1`,
autenticação `Authorization: Bearer <chave>`, 69 operações em 13 grupos. O escritório da chave
retornou 369 processos e clientes reais, então a credencial é válida e o formato dos dados está
confirmado (ex.: `lawsuits[]` com `number`, `court`, `status`, `valor_da_causa_in_cents`,
`customers[]`, `tags[]` e paginação `{count, page, pages, next}`; `customers[]` com `cpf_cnpj`,
`phone_mobile`, `tags[]`).

A API ainda oferece webhooks assinados por HMAC (`X-Webhook-Signature`) com eventos
`customer.created/updated/destroyed`, `activity.*`, `publications.created` e
`customer_inbound_email.created` — é o que permite sincronização em tempo real sem varredura.

## O que o usuário vai ver

Nova tela **Integrações › Tramitação Inteligente** (rota `/integracoes/tramitacao`), por escritório:

1. **Conexão** — campo da chave de API (mascarada após salvar), botão "Testar conexão" (chama
   `GET /clientes?per_page=1` e mostra o nome/contagem do escritório) e situação (conectado,
   chave inválida, sem resposta).
2. **Importação** — o que trazer para a Julia: processos, movimentações, clientes e publicações.
   Botão "Sincronizar agora" com barra de progresso e resumo (novos / atualizados / ignorados).
   Agendamento automático (a cada 30 min) ligável por escritório.
3. **Envio** — o que a Julia manda para lá: quando um lead do CRM chega a uma etapa escolhida
   (ex.: "Contrato assinado"), criar/atualizar o **cliente** na Tramitação (por CPF/CNPJ) e,
   opcionalmente, registrar uma **atividade** com o resumo do atendimento. Seleção da etapa
   gatilho e do CRM de origem.
4. **Vínculos e histórico** — lista de leads ↔ clientes/processos vinculados, com link para abrir
   no CRM da Julia, e log das últimas 100 sincronizações (direção, resultado, erro).
5. **No lead** — dentro do card do CRM e no painel da conversa, um bloco "Processos" mostrando os
   processos do cliente vinculado, com número, vara, status e as movimentações mais recentes.

Conflitos: o registro mais recente (`updated_at`) vence; em CPF/CNPJ igual, atualiza em vez de
duplicar. Nada é excluído automaticamente nos dois lados — exclusão remota só marca como inativo.

## Detalhes técnicos

**Banco (migração, tabelas `ti_*` com GRANT + RLS no padrão das demais)**
- `ti_credentials` — `client_id`, `api_key_encrypted`, `webhook_secret`, `webhook_endpoint_id`,
  `is_active`, `last_check_at`, `last_check_status`, timestamps + trigger.
- `ti_sync_config` — `client_id`, flags de importação, `auto_sync_enabled`, `sync_interval_minutes`,
  `export_trigger_stage_id`, `export_create_activity`, `board_id`.
- `ti_lawsuits`, `ti_lawsuit_movements`, `ti_customers` — espelho local somente-leitura (id remoto,
  `uuid`, payload normalizado + `raw jsonb`), únicos por (`client_id`, id remoto).
- `ti_links` — ponte `client_id` + tipo local (`deal`, `contact`) + id local + tipo/id remoto.
- `ti_sync_logs` — direção, operação, contadores, erro, duração.
- Índices por (`client_id`, `updated_at`) e por `cpf_cnpj`/`number` normalizados.

**Edge Functions**
- `ti-proxy` — gateway único no padrão `{action, data}` do projeto; resolve a chave pelo
  `client_id` (nunca aceita chave do cliente), aplica retry/backoff em 429/5xx, repassa
  status + corpo do erro, e nunca devolve a chave ao browser. Ações: `test`, `list_lawsuits`,
  `get_lawsuit`, `list_movements`, `list_customers`, `upsert_customer`, `create_activity`,
  `list_publications`, `register_webhook`.
- `ti-sync` — importação paginada e incremental (guarda o maior `updated_at` por recurso), grava
  no espelho e em `ti_sync_logs`; invocável manualmente ou por `pg_cron`.
- `ti-webhook` (`verify_jwt = false`) — recebe as entregas, valida o HMAC `X-Webhook-Signature`
  contra `webhook_secret`, deduplica por id da entrega e aplica o patch no espelho, disparando
  Realtime para a UI. O endpoint é registrado automaticamente via `POST /webhooks/endpoints`
  quando a chave é salva.
- `ti-export` — chamada pelo gatilho de etapa do CRM: procura o cliente por CPF/CNPJ
  (`GET /clientes?q=`), faz `POST`/`PATCH /clientes` e, se configurado, `POST /atividades`;
  grava o vínculo em `ti_links`.

**Frontend (módulo isolado `src/modules/tramitacao/`)**
- `extend/` reexportando `supabase`, `externalDb`, `useAuth`, `resolveEffectiveClientId`
  (mesmo padrão de `disparos`/`escritorios`).
- `pages/TramitacaoPage.tsx` com abas Conexão / Importação / Envio / Vínculos e histórico.
- `hooks/useTiCredentials.ts`, `useTiSync.ts`, `useTiLawsuits.ts`, `useTiLinks.ts` (React Query).
- `components/LawsuitsPanel.tsx` reutilizado no card do CRM e no painel da conversa.
- `hooks/useEnsureTramitacaoModule.ts` — auto-registro do módulo `integracao_tramitacao` no
  `modules` do banco legado, aparecendo no menu e na matriz de permissões.
- Rota protegida por `ProtectedRoute` com o módulo novo; escrita só para proprietário/admin
  (via `isOwner`/`hasPermission`).

**Segurança**
- Chave por escritório, cifrada com `src/lib/crypto.ts`, gravada e usada apenas no servidor.
- Toda chamada externa passa pelo `ti-proxy`; o front nunca fala com o domínio externo.
- Toda query do espelho filtra por `client_id` efetivo, como no resto do sistema.

## Fases

1. Migração + `ti-proxy` + tela de Conexão com teste (valor imediato: chave validada).
2. Importação de processos, movimentações e clientes + painel de processos no lead.
3. Webhooks assinados (tempo real) + agendamento automático.
4. Envio Julia → Tramitação (cliente + atividade) por gatilho de etapa, com log e vínculos.

## Validação

1. Salvar a chave e obter "conectado" com a contagem correta de clientes.
2. Importar e conferir 369 processos com números, varas e movimentações batendo com a origem.
3. Criar um cliente na Tramitação e ver o espelho atualizar sem nova importação manual (webhook).
4. Mover um lead para a etapa gatilho e conferir o cliente/atividade criados lá, sem duplicar
   quando repetido.
5. Chave inválida → mensagem clara na tela, sem quebrar as outras áreas do sistema.
