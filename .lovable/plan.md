# BlitzLeads — Módulo isolado dentro do projeto Julia

Um "fake projeto" totalmente encapsulado na pasta `src/blitzleads/`, com prefixo `blitzleads_` em toda persistência (tabelas, functions, edge functions) e acesso via subdomínio `blitzleads.atendejulia.com.br`. Reutiliza autenticação e infra do app Julia, mas com árvore de rotas, layout, DB, e sessão de UI próprios.

## 1. Arquitetura de isolamento

```text
src/blitzleads/
├── BlitzApp.tsx              # árvore de rotas <Routes> do módulo
├── layout/
│   ├── BlitzLayout.tsx       # sidebar + header BlitzLeads (logo header)
│   └── BlitzHeader.tsx
├── pages/
│   ├── BlitzAuth.tsx         # login (logo grande + copy) — layout do artifact
│   ├── BlitzDashboard.tsx    # KPIs + lista de casos (Call Center)
│   └── BlitzCallCenter.tsx   # tela principal do protótipo
├── components/
│   ├── CaseCard.tsx
│   ├── KpiCard.tsx
│   └── StatusFilter.tsx
├── guards/
│   └── BlitzProtectedRoute.tsx
├── contexts/
│   └── BlitzAuthContext.tsx  # ponte com AuthContext existente
├── hooks/
│   └── useBlitzRouteMap.ts   # lê blitzleads_route_config
├── lib/
│   ├── blitzClient.ts        # wrapper do supabase para tabelas blitzleads_*
│   └── subdomain.ts          # detecta host blitzleads.*
└── assets/
    ├── blitzleads-login.png   # logo 1 (com tagline)
    └── blitzleads-header.png  # logo 2 (para header)
```

Regras:
- Nenhum arquivo fora de `src/blitzleads/` é modificado, exceto: `src/App.tsx` (montar rota `/BlitzLead/*` + gate de subdomínio no `/login`) e configuração adicional em `ConfiguracoesPage` (nova aba).
- Se precisar reaproveitar algo do app principal (`AuthContext`, `supabase client`, shadcn/ui), o consumo é feito por um arquivo dentro de `src/blitzleads/` que reexporta/extende — nunca importa direto em cima do símbolo original.

## 2. Roteamento e subdomínio

- Nova rota mãe no `App.tsx`: `<Route path="/BlitzLead/*" element={<BlitzApp />} />`.
- `BlitzApp` monta internamente:
  - `/BlitzLead/blitz_auth` → `BlitzAuth` (login próprio)
  - `/BlitzLead/` → `BlitzDashboard` (dentro de `BlitzLayout` + `BlitzProtectedRoute`)
  - `/BlitzLead/call-center` → `BlitzCallCenter`
- Detecção de subdomínio (`src/blitzleads/lib/subdomain.ts`):
  - `isBlitzHost = window.location.hostname.startsWith("blitzleads.")`
  - Se `isBlitzHost` e path não começar com `/BlitzLead`, redireciona para `/BlitzLead + path atual` (mantém deep-link).
  - Rota `/blitz_auth` (raiz do subdomínio) resolve para `/BlitzLead/blitz_auth`.
- Rota `/BlitzLead/blitz_auth` só renderiza a tela de login quando `isBlitzHost === true`; em qualquer outro host redireciona para `/login` do Julia.
- Se usuário já tem sessão Julia ao abrir `blitzleads.atendejulia.com.br`:
  - `BlitzAuth` detecta sessão via `AuthContext` e mostra card "Acessando via painel Julia" com botão "Entrar no BlitzLeads" que leva a `/BlitzLead/`.
- Se não tem sessão e está em subdomínio Blitz → mostra formulário de login (mesmo fluxo `supabase.auth.signInWithPassword`, mas na UI Blitz).
- Se não tem sessão e não está no subdomínio → redireciona para `/login` do Julia.

## 3. Configuração dinâmica de rotas (aba em /configuracoes)

Nova aba "BlitzLeads" em `ConfiguracoesPage` com campos:
- **Domínio configurado** (input): `blitzleads.atendejulia.com.br`
- **Mapa de rotas** (editor JSON key→value com botão "Adicionar rota"):
  - Ex.: `{ "/": "/BlitzLead/", "/blitz_auth": "/BlitzLead/blitz_auth", "/call-center": "/BlitzLead/call-center" }`
- Persistido em `blitzleads_route_config` (linha singleton por client) → coluna `mappings jsonb`.
- `useBlitzRouteMap` lê essa config no boot do módulo e o gate de subdomínio aplica os "de-para" antes de resolver a rota interna. Fallback: array de defaults hardcoded no código quando a tabela estiver vazia.

## 4. Banco de dados (migration única)

Todas as tabelas com prefixo `blitzleads_`, RLS + GRANTs, escopo por `client_id`:

- `blitzleads_route_config` — mapeamento de rotas
  - `client_id uuid`, `domain text`, `mappings jsonb not null default '{}'`
- `blitzleads_cases` — casos exibidos no Call Center
  - `client_id`, `contact_name text`, `phone text`, `product text`, `subject text`,
    `status text` (parou | objecao | qualificado | nao_assinado | assinado),
    `priority int`, `sla_deadline timestamptz`, `score int`, `next_action text`, `assigned_to uuid`
- `blitzleads_case_events` — histórico de interações do caso
  - `case_id`, `event_type`, `payload jsonb`, `actor_id`
- `blitzleads_settings` — configurações gerais (thresholds SLA etc)

Cada tabela segue estrutura obrigatória:
1. CREATE TABLE
2. GRANT SELECT/INSERT/UPDATE/DELETE ao `authenticated`, ALL ao `service_role`
3. ENABLE RLS
4. POLICY escopada por `client_id = get_current_client_id()` (helper existente) e admin bypass via `has_role`.

Trigger `update_updated_at_column` reutilizado.

## 5. Edge functions (prefixadas)

Criadas em `supabase/functions/blitzleads_*`:
- `blitzleads_cases_list` — lista casos com filtros de status/urgência.
- `blitzleads_case_next_urgent` — implementa "Pegar próximo urgente" (retorna caso e trava temporária).
- `blitzleads_case_update_status` — muda status + grava evento.

Cada função:
- Import de `corsHeaders` via `npm:@supabase/supabase-js@2/cors`.
- Validação Zod dos inputs.
- Auth via JWT do usuário (revalidação com `supabase.auth.getUser`).
- Sem acesso a tabelas fora do prefixo `blitzleads_`.

## 6. UI (layout do artifact)

Tela `BlitzCallCenter`:
- 4 cards de KPI no topo (Casos urgentes, SLA estourado, Recuperados hoje, Taxa de ganho).
- Filtros por status (chips: Todos, Parou, Objeção, Qualificado, Não assinado, Assinado) + botão "⚡ Pegar próximo urgente".
- Grid de `CaseCard` — borda colorida por status, badge URGENTE, contador SLA, score, "Próxima ação".
- Tokens de cor semânticos (adicionados em `index.css` só como variáveis `--blitz-*`, sem alterar tokens globais existentes).

Tela `BlitzAuth`:
- Split screen igual ao Julia (logo login à esquerda, painel escuro à direita), mas usando `blitzleads-login.png` e cores azul BlitzLeads.
- Copy: "Recupere. Qualifique. Converta."
- Estado "sessão Julia detectada" mostra card de bypass no lugar do formulário.

## 7. Assets

- Copiar `user-uploads://BlitzLeads_1.png` → `src/blitzleads/assets/blitzleads-login.png`
- Copiar `user-uploads://BlitzLeads.png` → `src/blitzleads/assets/blitzleads-header.png`

## 8. Ordem de execução

1. Migration: `blitzleads_route_config`, `blitzleads_cases`, `blitzleads_case_events`, `blitzleads_settings` (RLS + GRANTs).
2. Copiar assets.
3. Criar estrutura `src/blitzleads/` (client, subdomain, layout, guards, contexto).
4. `BlitzAuth`, `BlitzDashboard`, `BlitzCallCenter` com dados reais das tabelas.
5. Registrar `/BlitzLead/*` em `src/App.tsx` + gate de subdomínio no boot.
6. Aba "BlitzLeads" em `/configuracoes` (domínio + editor JSON de mapeamento).
7. Edge functions `blitzleads_*`.
8. Seed mínimo (via UI) desativado; sem dados fake — telas vazias mostram estado inicial.

## 9. Fora de escopo (não farei nesta rodada)

- Configurar DNS/subdomínio real (o usuário aponta `blitzleads.atendejulia.com.br` no painel de domínios do Lovable — já é um domínio conectado ao projeto).
- Migrar dados existentes do CRM Julia para `blitzleads_cases` (BlitzLeads começa vazio; ingestão futura por edge function dedicada).
- Telefonia/chat integrados ao BlitzLeads (botão "Ligar" apenas registra evento nesta fase).

Confirma que posso seguir com esse plano e implementar?