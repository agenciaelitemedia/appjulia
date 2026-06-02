# Planejamento: Gestão de Templates WABA (API Oficial WhatsApp)

## Objetivo

Adicionar nova aba **"Templates WABA"** em `/chat/configuracoes` que, quando o cliente tem ao menos uma fila WABA conectada, permita selecionar a fila e gerenciar todos os Message Templates daquela WABA com a mesma fidelidade do Gerenciador de Negócios da Meta — criar, editar (rascunhos), enviar para análise, acompanhar status de aprovação, sincronizar, pausar e excluir.

A interface replica o fluxo de 3 passos da Meta (Configurar → Editar → Enviar para análise) com prévia em tempo real à direita.

---

## 1. Fluxo do usuário

```text
/chat/configuracoes
 └─ Aba "Templates WABA" (visível só para admin/colaborador, e só se houver agent.hub='waba')
     ├─ Seletor de Fila WABA (dropdown)        [topo]
     ├─ Banner com WABA ID + número conectado  [topo]
     ├─ Filtros: busca | categoria | idioma | status | última edição
     ├─ Botão [+ Criar modelo]
     └─ Tabela: Nome | Categoria | Idioma | Status | Enviadas | Lidas | Última edição | ações (editar rascunho, duplicar, excluir, pausar)

Dialog "Criar modelo" (3 passos com Stepper):
  Passo 1 — Configurar
     • Categoria: Marketing | Utilidade | Autenticação
     • Subtipo (Marketing): Padrão | Catálogo | Flows | Permissão p/ ligação
       (V1 entrega apenas "Padrão"; outros tipos marcados como "em breve")
  Passo 2 — Editar
     • Nome (snake_case, 1–512) + Idioma (pt_BR, en_US, es_ES, etc.)
     • Tipo de variável: Número {{1}} | Nomeada {{nome}}
     • Cabeçalho: Nenhum | Texto (60ch) | Imagem | Vídeo | Documento | Localização
     • Corpo (1024ch) com formatação *bold* _italic_ ~strike~ ```mono``` e + Variável
     • Rodapé (60ch, opcional)
     • Botões (até 10): Quick Reply, URL (estática/dinâmica), Phone, Copy code, Flow
     • Painel direito: Prévia ao vivo estilo WhatsApp
  Passo 3 — Enviar para análise
     • Validação local (regex Meta, contadores)
     • Upload de amostra de mídia → Resumable Upload API (header handle)
     • POST /{WABA_ID}/message_templates
     • Toast + linha aparece na tabela com status "PENDING / Em análise"
```

---

## 2. Backend — Edge Function `waba-templates`

Nova função `supabase/functions/waba-templates/index.ts` (mesmo padrão do `waba-admin`: carrega `waba_id`, `waba_token` da tabela `agents` por `agent_id`, sempre via proxy server-side com `verify_jwt = true`).

**Actions suportadas** (body `{ action, agent_id, ... }`):

| Action | Verb Meta Graph v22.0 | Descrição |
|---|---|---|
| `list` | GET `/{WABA_ID}/message_templates?fields=name,language,category,status,components,quality_score,id&limit=100` (paginado) | Lista todos templates |
| `get` | GET `/{template_id}` | Detalhe de 1 template (para editar) |
| `create` | POST `/{WABA_ID}/message_templates` | Cria + envia para análise |
| `edit` | POST `/{template_id}` (apenas templates APPROVED ou REJECTED podem ser editados; categoria não muda) | Editar e reenviar |
| `delete` | DELETE `/{WABA_ID}/message_templates?hsm_id=<id>&name=<name>` | Remove |
| `upload_media_handle` | POST `https://graph.facebook.com/v22.0/{APP_ID}/uploads` → POST com binário → retorna `h` (handle) | Para `HEADER_HANDLE` de amostra |
| `sync` | chama `list` e faz UPSERT em `waba_templates` local | Cache + busca rápida |

Tratamento de erros Meta (mensagens amigáveis em PT-BR para códigos comuns: 132000, 132001, 132005, 132007, 132012, 100, 190).

---

## 3. Banco de dados — Cache local

Migration nova:

```sql
CREATE TABLE public.waba_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id bigint NOT NULL,
  cod_agent bigint NOT NULL,
  meta_template_id text NOT NULL,
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL,                -- MARKETING | UTILITY | AUTHENTICATION
  sub_category text,                     -- STANDARD | CATALOG | FLOWS | CALL_PERMISSION_REQUEST
  status text NOT NULL,                  -- PENDING | APPROVED | REJECTED | PAUSED | DISABLED | IN_APPEAL
  rejection_reason text,
  quality_score jsonb,
  components jsonb NOT NULL,             -- header/body/footer/buttons (formato Meta)
  last_edited_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (cod_agent, name, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waba_templates TO authenticated;
GRANT ALL ON public.waba_templates TO service_role;
ALTER TABLE public.waba_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client members read templates"
  ON public.waba_templates FOR SELECT TO authenticated
  USING (client_id IN (SELECT client_id FROM public.user_clients WHERE user_id = auth.uid()));

CREATE POLICY "admin/colab manage templates"
  ON public.waba_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'colaborador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'colaborador'));
```

A tabela é apenas espelho/cache — a fonte de verdade é a Meta. Sincronização: ao abrir a aba + botão manual "Sincronizar agora" + após cada create/edit/delete.

---

## 4. Frontend — Arquivos novos

```text
src/pages/chat/ChatWabaTemplatesPage.tsx           ← container da aba (embedded)
src/pages/chat/waba-templates/
  ├─ WabaQueueSelector.tsx                         ← dropdown de filas WABA
  ├─ TemplatesToolbar.tsx                          ← busca + filtros + criar
  ├─ TemplatesTable.tsx                            ← listagem com status badges
  ├─ TemplateStatusBadge.tsx                       ← cores por status Meta
  ├─ TemplateDeleteDialog.tsx                      ← confirmação dupla (memória do projeto)
  ├─ TemplateBuilderDialog.tsx                     ← wrapper 3 passos
  ├─ steps/Step1Configure.tsx
  ├─ steps/Step2Edit.tsx
  │   ├─ HeaderEditor.tsx (nenhum/texto/mídia/loc)
  │   ├─ BodyEditor.tsx   (formatação + variáveis)
  │   ├─ FooterEditor.tsx
  │   └─ ButtonsEditor.tsx (quick reply / url / phone / copy code)
  ├─ steps/Step3Review.tsx                         ← validação final + submit
  ├─ WhatsappPreview.tsx                           ← prévia fiel ao chat WPP
  └─ hooks/
      ├─ useWabaQueues.ts                          ← lista agents hub='waba'
      ├─ useWabaTemplates.ts                       ← list/sync via edge
      ├─ useWabaTemplateMutation.ts                ← create/edit/delete
      └─ useMediaSampleUpload.ts                   ← Resumable Upload
```

**Aba** registrada em `ChatSettingsPage.tsx` (`isAdmin` only), com guard que oculta a aba quando não há agente WABA conectado para o cliente.

---

## 5. Validações fiéis à Meta

Implementadas no front + revalidadas no edge function:

- `name`: `^[a-z0-9_]{1,512}$`
- Corpo: 1024 chars; variáveis sequenciais `{{1}}, {{2}}…` sem pular; exemplo obrigatório para cada variável
- Cabeçalho: 60 chars (texto) ou `format: IMAGE/VIDEO/DOCUMENT/LOCATION` com `example.header_handle`
- Rodapé: 60 chars, sem variáveis
- Botões: máx 10; máx 1 phone, máx 2 URL, máx 1 copy code; texto ≤ 25 chars; Quick Reply texto ≤ 25
- Categoria Autenticação: corpo fixo (template OTP), sem rodapé, botão obrigatório copy-code ou one-tap
- URL dinâmica: `example` é obrigatório

---

## 6. Upload de amostras de mídia (header)

Para `IMAGE/VIDEO/DOCUMENT`, a Meta exige `header_handle` obtido pela **Resumable Upload API**:

1. `POST https://graph.facebook.com/v22.0/{APP_ID}/uploads?file_length=…&file_type=…` → retorna `id` da sessão
2. `POST https://graph.facebook.com/v22.0/{upload_session_id}` com binário e header `file_offset: 0` → retorna `{ "h": "<handle>" }`
3. Esse `h` vai em `components[0].example.header_handle[0]`

Usaremos o `APP_ID` da Meta App já cadastrado em secrets (`META_APP_ID`) — o front faz upload do arquivo direto para a edge `waba-templates/upload_media_handle` (server-side, para não vazar token).

---

## 7. Sincronização e webhook

- Sincronização sob demanda + ao abrir a aba (debounce 30s).
- Adicional (V2): subscrever evento `message_template_status_update` no webhook `meta-webhook` para atualizar `waba_templates.status` em tempo real (ex.: aprovação leva minutos a horas).

---

## 8. Permissões e segurança

- Aba visível só para `admin` e `colaborador` (memória do projeto: padrão usado em "Abrir ticket de suporte").
- Edge function valida `has_role` antes de executar mutações.
- Exclusão usa o padrão "switch + dupla confirmação" (memória `secure-deletion-workflow`).

---

## 9. Detalhes técnicos relevantes

- Meta Graph API versão **v22.0** (mesma do projeto, conferido em `waba-admin` e `waba-send`).
- Credenciais lidas via `agents.waba_id` + `agents.waba_token` (memória `whatsapp-credential-source`).
- Edge functions usam o adapter `_shared/waba` quando aplicável (memória `waba-shared-adapter`).
- `supabase/config.toml`: adicionar bloco para `waba-templates` com `verify_jwt = true`.
- Componentes shadcn já presentes: `Tabs`, `Dialog`, `Select`, `Table`, `Badge`, `Stepper` (criar utilitário simples se não existir).
- Estado do builder: `react-hook-form` + `zod` por etapa.
- Cache: `@tanstack/react-query` com `staleTime: 30_000`.

---

## 10. Entrega faseada

**V1 (este planejamento):**
- Aba + seletor de fila + tabela com sync + filtros
- Builder 3 passos categoria Marketing/Padrão + Utilidade + Autenticação (texto + mídia)
- Botões: Quick Reply, URL estática, Phone, Copy Code
- Excluir + duplicar

**V2 (não incluído agora):**
- Botões: URL dinâmica, Flow, Catálogo
- Editar templates aprovados/rejeitados
- Webhook `message_template_status_update`
- Insights (`/template_analytics`)
- Tradução automática de template entre idiomas via Lovable AI

---

## Resumo das mudanças

- 1 migration (`waba_templates`)
- 1 edge function nova (`waba-templates`) + entrada no `config.toml`
- ~15 arquivos novos em `src/pages/chat/waba-templates/`
- 1 arquivo editado (`ChatSettingsPage.tsx`) para adicionar a aba

Aguardando aprovação para implementar a V1.
