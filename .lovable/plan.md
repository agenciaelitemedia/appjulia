## Objetivo

Adicionar aba **Provedores** em `/admin/wavoip` (após Dispositivos) para cadastrar contas Wavoip. Ao salvar, faz login na Wavoip API e persiste o token retornado.

## 1. Banco (migration)

Tabela `wavoip_providers`:
- `id` uuid PK
- `name` text (nome do provedor)
- `type` text CHECK IN (`wavoip_multicanal`, `wavoip_free`)
- `api_base` text NOT NULL DEFAULT `https://api.wavoip.com`
- `username` text (email)
- `password` text (em texto plano, armazenado no banco — sem criptografia extra; RLS restringe leitura só a admins)
- `token` text (JWT retornado do login)
- `token_updated_at` timestamptz
- `last_login_status` text, `last_login_error` text
- `is_active` boolean default true
- `created_by` uuid, `created_at`, `updated_at` (+ trigger update_updated_at)

GRANTs: `SELECT/INSERT/UPDATE/DELETE` para `authenticated`, `ALL` para `service_role`. RLS: apenas admins (`has_role(auth.uid(),'admin')`) fazem CRUD.

Sem secrets novos.

## 2. Edge Function `wavoip-providers`

Actions:
- `list` → retorna provedores (mascara `password` e `token` no retorno para o frontend)
- `create` → recebe `{name, type, api_base, username, password}`. Chama `POST {api_base}/v2/login` com `{email:username, password}`, extrai `data.token`, insere no banco com `token`, `token_updated_at=now()`, `last_login_status='ok'`. Em erro grava `last_login_status='error'` + `last_login_error`.
- `update` → edita cadastro; se senha/username/api_base mudar, refaz login
- `delete` → remove
- `refresh_token(id)` → refaz login com credenciais salvas
- `get_token(id)` → helper interno (para outras edge functions) retorna token bruto

Validação com Zod, CORS padrão, verificação de admin via `has_role`.

## 3. Frontend

- `src/pages/admin/wavoip/WavoipAdminPage.tsx`: adicionar `<TabsTrigger value="providers">` (ícone `Server`) entre Dispositivos e Histórico, `grid-cols-6`.
- `src/pages/admin/wavoip/components/WavoipProvidersTab.tsx` (novo):
  - Tabela: Nome, Tipo (badge), API Base, Usuário, Status Token (OK/Erro + data), Ações (Editar, Refazer Login, Excluir com dupla confirmação)
  - Botão "Novo Provedor" → dialog com formulário:
    - Nome (text)
    - Tipo (Select: Wavoip Multicanal / Wavoip Free)
    - API Base (text, default preenchido `https://api.wavoip.com`)
    - Usuário (email)
    - Senha (password)
  - Toast: "Login realizado e token salvo" ou mensagem de erro da Wavoip
- `src/pages/admin/wavoip/hooks/useWavoipProviders.ts` (novo): CRUD via `supabase.functions.invoke('wavoip-providers', ...)`.

## 4. Memória Wavoip API

- Novo `mem/integrations/wavoip/api-reference.md` com resumo estruturado de todos endpoints do Postman (`API_-_Wavoip.postman_collection.json`): Auth (Login), Devices (list/calls), demais WAV Painel — método, path, body, resposta.
- Atualizar `mem/index.md`:
  `- [Wavoip API](mem://integrations/wavoip/api-reference) — Referência completa endpoints Wavoip V2 e WAV Painel`

## Detalhes técnicos

- Login: `POST {api_base}/v2/login` body `{email, password}` → `data.token` (JWT)
- Token JWT sem expiração curta observada; `refresh_token` disponível sob demanda
- Password em texto plano no banco, protegido apenas por RLS de admin (conforme solicitado)

## Arquivos

Novos:
- `supabase/migrations/<ts>_wavoip_providers.sql`
- `supabase/functions/wavoip-providers/index.ts`
- `src/pages/admin/wavoip/components/WavoipProvidersTab.tsx`
- `src/pages/admin/wavoip/hooks/useWavoipProviders.ts`
- `mem/integrations/wavoip/api-reference.md`

Editados:
- `src/pages/admin/wavoip/WavoipAdminPage.tsx`
- `mem/index.md`
