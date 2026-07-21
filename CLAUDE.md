# Julia — Visão Geral do Projeto

SaaS multi-tenant para escritórios de advocacia: atendimento omnichannel via WhatsApp (com agentes de IA), CRM, helpdesk, telefonia, telemetria e integrações jurídicas. Deploy via Lovable Cloud.

Esta documentação foi gerada por um estudo profundo do código (não é aspiracional — reflete o que existe). Ela é o ponto de entrada; os detalhes por domínio estão em `docs/`.

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript (config frouxo: `strictNullChecks:false`, `noImplicitAny:false`) + shadcn/Radix + Tailwind + React Query (`staleTime 30s`, `refetchOnWindowFocus:false`) + React Router 6. Alias `@/* → ./src/*`.
- **Backend**: Supabase (Postgres gerenciado + ~118 edge functions Deno + Storage + Realtime), **mais** um **Postgres externo legado** (managed DB, porta 25061) acessado só via a edge function `db-query`.
- **Auth**: própria (bcrypt), não usa Supabase Auth. Sessão em `localStorage`.
- **Telefonia**: SIP (api4com, 3cplus) via JsSIP + Wavoip (chamadas por WhatsApp) + vellip (CDR only).
- **Vídeo**: Daily.co (`@daily-co/daily-js`).
- **Pagamentos**: Mercado Pago, Asaas, InfinityPay.
- **IA**: Lovable AI Gateway (Gemini 2.5 Flash / 3 Flash Preview por padrão) com fallback OpenRouter, configurável por feature em `client_ai_model_config`.

## Os Dois Bancos de Dados

1. **Supabase** — tabelas app-native: chat (maior domínio, ~50 tabelas), CRM Builder, tickets, telemetria, telefonia (Wavoip/SIP), billing, ajuda, notificações. Cliente: `src/integrations/supabase/client.ts`.
2. **Postgres externo (legado)** — `users`, `clients` (= tenant real), `agents` (agente de IA, `cod_agent`), `user_agents`, `sessions`, `log_messages`, `crm_atendimento_cards/stages/history` (CRM de leads "clássico"), `campaing_ads` (Meta Ads), `modules`/`user_permissions`, tabelas Advbox. Acesso **exclusivo** via edge function `db-query` (`supabase/functions/db-query/index.ts`, ~120 actions) e o wrapper `src/lib/externalDb.ts`.

Detalhe completo (todas as actions do `db-query`, schema por domínio): **[docs/data-layer.md](docs/data-layer.md)**.

## ⚠️ Postura de Segurança (ler antes de mexer em auth/dados)

- **RLS do Supabase é permissiva em quase tudo**: `USING (true) WITH CHECK (true)` confirmado em ~100 migrations. Isolamento de tenant **não é garantido pelo banco**, só pela aplicação.
- **`db-query` expõe a action `raw`**: executa `sql.unsafe(query, params)` com a query vinda do frontend (`externalDb.raw(...)`), sem allowlist de tabela/verbo. A action `select` genérica também interpola coluna/orderBy sem sanitização.
- **40+ edge functions com `verify_jwt=false`** (`supabase/config.toml`) — esperado para webhooks de terceiros (Meta, Asaas, uazapi, api4com, 3cplus, Wavoip, InfinityPay), mas algumas não-webhook também estão abertas (`waba-send`, `send-push`, `ai-provider-key-set`, `queue-*`, `telemetry`).
- **Multi-tenancy por `client_id`** é resolvido em runtime (`resolveEffectiveClientId`, herança via `users.user_id → parent.client_id`) e filtrado no código/queries — não há constraint de banco impedindo cross-tenant.
- Rotas `/chat/*` (24 sub-rotas) e `/advbox/*` **não têm proteção de módulo** no `ProtectedRoute` — só exigem estar autenticado.

Isso não é bloqueante para features novas, mas qualquer mudança em auth, RLS, ou na função `db-query` deve ser tratada como sensível (staging + incremental, nunca big-bang).

## Autenticação & Autorização

- Login: `externalDb.login(email, password)` → bcrypt verificado no `db-query` (nunca no browser). `is_active=false` bloqueia.
- Roles (`AppRole`): `admin | user | colaborador | time | advogado | comercial`. `admin` sempre passa em `hasPermission`. `time/advogado/comercial` são membros de equipe vinculados a um titular (`user`/`admin`) e herdam `client_id`.
- Permissões por módulo (`ModuleCode` ∪ string dinâmica para embeds): `can_view/create/edit/delete`, custom por usuário (`use_custom_permissions`) ou herdado de `role_default_permissions`.
- Inatividade: `INACTIVITY_TIMEOUT_MS = 30min` (const real; comentários no código dizem "1h" — desatualizado). Logout sincroniza entre abas via `storage` event.
- Avatar: prioridade `user_avatars.photo_url` (Supabase, por usuário) → fallback `clients.photo` (externo, logo do escritório).

Detalhe completo: **[docs/data-layer.md](docs/data-layer.md#autenticação--autorização)**.

## Versionamento

Build-time auto-bump de PATCH (`vite-plugin-auto-version.ts`): MAJOR.MINOR = maior entre `package.json` e `public/version.json`; PATCH incrementa a cada build. No login, `checkVersionAndReloadIfNeeded` compara `/version.json` com `__APP_VERSION__` embutido; se diferente, desregistra Service Workers, limpa caches, preserva só `AUTH_USER`/`AUTH_LAST_ACTIVITY` e recarrega.

## Módulos (domínios funcionais)

| Domínio | Rota raiz | Módulo (`ProtectedRoute`) | Doc |
|---|---|---|---|
| Chat/Inbox omnichannel (uazapi, WABA, Instagram, WebChat) | `/chat/*` (24 sub-rotas) | **nenhuma proteção de módulo** | [docs/chat.md](docs/chat.md) |
| CRM de leads (WhatsApp) | `/crm/leads` | `crm_leads` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md) |
| CRM Builder (Kanban) | `/crm-builder` | `crm_leads` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#2-crm-builder-kanban) |
| Agentes de IA | `/agente/meus-agentes` | `agent_management` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#3-agentes-de-ia) |
| Filas (queues) | `/agente/filas` | `filas` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#3-agentes-de-ia) |
| Followup | `/agente/followup` | `followup` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#4-followup) |
| Contratos | `/estrategico/contratos` | `strategic_contract` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#5-contratos) |
| Advbox / DataJud | `/advbox/*`, `/datajud` | sem proteção / `datajud` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#6-integrações-jurídicas) |
| Copiloto IA / Prompts | `/admin/copiloto`, `/admin/prompts` | `copilot_admin`, `prompt_generator` | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#7-copiloto--ia-admin) |
| Tickets / Helpdesk | `/tickets` | `support_tickets` | [docs/tickets-telemetry.md](docs/tickets-telemetry.md#1-ticketshelpdesk) |
| Telemetria (Ambiente & Performance) | `/admin/monitoramento` | `admin_agents` | [docs/tickets-telemetry.md](docs/tickets-telemetry.md#2-telemetria) |
| Notificações internas | `/notificar-clientes` | `notify_customers` | [docs/tickets-telemetry.md](docs/tickets-telemetry.md#3-notificações) |
| Telefonia (SIP + Wavoip) | `/telefonia`, `/wavoip` | `telephony`, `wavoip` | [docs/telephony-payments.md](docs/telephony-payments.md#1-2-telefonia) |
| Pagamentos/Checkout | `/comprar`, `/admin/pedidos` | `julia_orders` | [docs/telephony-payments.md](docs/telephony-payments.md#3-pagamentoscheckout) |
| Vídeo (Daily.co) | `/video/queue`, `/call/:roomName` | — | [docs/telephony-payments.md](docs/telephony-payments.md#5-vídeo-callDaily-co) |
| Admin (permissões, módulos, planos) | `/admin/*` | `admin_agents` (maioria) | [docs/crm-agents-legal.md](docs/crm-agents-legal.md#8-admin) |

Tabela completa de rotas: **[docs/data-layer.md](docs/data-layer.md#roteamento)**.

Detalhe interno do webhook uazapi (parsing, dedup, pipeline de histórico): **[docs/uazapi-integration.md](docs/uazapi-integration.md)**.

## Padrão "auto-registro de módulo"

Dezenas de hooks `useEnsure*Module.ts` (ex.: `useEnsureTicketsModule`, `useEnsureDataJudModule`) — cada módulo opcional, ao montar pela 1ª vez, garante sua própria entrada em `modules` (Postgres externo, via `externalDb.createModule`), aparecendo automaticamente no menu e na matriz de permissões sem migration manual. Reuse esse padrão para módulos novos.

## Notas de leitura

- Este documento e os arquivos em `docs/` foram gerados por análise de código em 2026-06 e refletem o estado do repo naquele momento. Para features específicas recém-alteradas, prefira ler o código atual — schema evolui por migrations incrementais (`ALTER TABLE ADD COLUMN IF NOT EXISTS`), então colunas usadas no frontend podem não aparecer no `CREATE TABLE` original citado nos docs.
- Convenção de edge function: JSON `{action, data}` roteado por `switch`, service-role key, CORS aberto. Ver exemplos em `db-query`, `telemetry`, `client-files` (futuro).
