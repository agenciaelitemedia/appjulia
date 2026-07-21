---
name: BlitzLeads Module Architecture
description: Fake-projeto isolado dentro do Julia com prefixo blitzleads_, subdomínio próprio, layout escuro e integração com AuthContext existente
type: feature
---
# BlitzLeads — Módulo isolado

Sistema de recuperação de leads ("Recupere. Qualifique. Converta.") empacotado como fake-projeto dentro do app Julia.

## Isolamento
- Toda a base fica em `src/blitzleads/` (layout, pages, components, hooks, lib, guards, contexts, assets).
- Único acoplamento externo: registro da rota mãe `/BlitzLead/*` em `src/App.tsx` e aba "BlitzLeads" em `ConfiguracoesPage`.
- Reuso do app principal (AuthContext, supabase client, shadcn) SEMPRE via arquivo dentro de `src/blitzleads/` que reexporta/estende — nunca importar direto.
- Prefixo obrigatório `blitzleads_` em TODA persistência: tabelas, edge functions, functions SQL, buckets.

## Roteamento e subdomínio
- Domínio dedicado: `blitzleads.atendejulia.com.br`.
- `src/blitzleads/lib/subdomain.ts` detecta `hostname.startsWith("blitzleads.")` e força prefixo `/BlitzLead` mantendo deep-link.
- Rotas em `src/blitzleads/routes.tsx`:
  - `/BlitzLead/blitz_auth` — login próprio; fora do subdomínio redireciona para `/login` do Julia.
  - `/BlitzLead/` — dashboard dentro de `BlitzLayout` + `BlitzProtectedRoute`.
  - `/BlitzLead/call-center`, `/BlitzLead/case/:id`.
- Se há sessão Julia ativa no subdomínio, `BlitzAuth` mostra card "Acessando via painel Julia" com bypass; sem sessão fora do subdomínio → `/login` do Julia.

## Configuração dinâmica de rotas
- Aba "BlitzLeads" em `/configuracoes` edita domínio + mapa JSON `de→para`.
- Persistido em `blitzleads_route_config.mappings jsonb` (singleton por client).
- `useBlitzRouteMap` lê no boot; fallback = defaults hardcoded quando tabela vazia.

## Banco (RLS + GRANTs, escopo `client_id = get_current_client_id()` + admin bypass via `has_role`)
- `blitzleads_route_config`: `client_id`, `domain`, `mappings jsonb`.
- `blitzleads_cases`: `contact_name`, `phone`, `product`, `subject`, `status` (parou|objecao|qualificado|nao_assinado|assinado), `priority`, `sla_deadline`, `score`, `next_action`, `assigned_to`, `metadata jsonb`.
- `blitzleads_case_events`: `case_id`, `event_type`, `payload`, `actor_id`.
- `blitzleads_settings`: thresholds/config geral.

## Edge functions (`blitzleads_*`)
- `blitzleads_cases_list`, `blitzleads_case_next_urgent`, `blitzleads_case_update_status`.
- Auth via JWT do usuário; sem acesso a tabelas fora do prefixo.

## UI / Design tokens
- Layout claro (`bg-slate-100`) + sidebar dark fixa (`BlitzSidebar`) + `BlitzTopbar` sticky (search, chips de alerta, bell com dropdown).
- Paleta por status: parou=rose, objecao=amber, qualificado=violet, nao_assinado=sky, assinado=emerald. CTA principal `bg-violet-600`.
- CaseCards: borda esquerda 6px colorida por status, badge URGENTE, contador SLA, score com raio âmbar, bloco "Próxima ação".
- KPIs: Casos urgentes, SLA estourado, Recuperados hoje, Taxa de ganho.
- Logo do sidebar usa `mix-blend-mode: screen` para eliminar o fundo preto do PNG — nunca usar bloco branco atrás da logo.
- Asset: `src/blitzleads/assets/blitzleads-sidebar.png`.

## Fora de escopo atual
- DNS apontado pelo usuário no painel de domínios do Lovable.
- Sem ingestão automática do CRM Julia; BlitzLeads começa vazio.
- Telefonia/chat ainda não integrados — botão "Ligar" grava evento apenas.
