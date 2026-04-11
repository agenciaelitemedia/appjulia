

## Plano: Página de Configurações com Provedores de Fila e Fluxo de Criação por Steps

### Resumo

Criar uma página de **Configurações** (`/configuracoes`) com aba **Provedores de Fila** onde se centralizam as credenciais dos provedores (UaZapi, Meta/WABA, Instagram, WebChat). O fluxo de criação de filas muda de um formulário único para um wizard com cards de seleção de tipo + steps específicos por canal.

### Fase 1: Tabela `queue_providers` no Supabase

Nova tabela para armazenar configurações de provedores por `client_id`:

```sql
CREATE TABLE public.queue_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  provider_type text NOT NULL, -- 'uazapi', 'waba', 'instagram', 'webchat'
  name text NOT NULL,
  -- UaZapi
  evo_url text,
  evo_apikey text,
  -- WABA / Meta App
  meta_app_id text,
  meta_app_secret text,
  waba_business_id text,
  waba_token text,
  -- Instagram (usa mesmo Meta App)
  instagram_page_id text,
  instagram_user_id text,
  page_access_token text,
  page_name text,
  -- WebChat (referencia webchat_config existente)
  webchat_config_id uuid,
  --
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on queue_providers" ON public.queue_providers FOR ALL USING (true) WITH CHECK (true);
```

### Fase 2: Página de Configurações (`/configuracoes`)

**Arquivo:** `src/pages/configuracoes/ConfiguracoesPage.tsx`

- Layout com Tabs: primeira aba **Provedores de Fila**
- Extensível para futuras abas de configuração

**Aba Provedores de Fila:**
- Lista cards dos provedores configurados (UaZapi, WABA, Instagram, WebChat)
- Botão "Novo Provedor" abre dialog com seleção de tipo
- Formulário específico por tipo:
  - **UaZapi**: URL da API, API Key (dados globais da instância admin)
  - **WABA**: Meta App ID, App Secret, WABA Business ID, Token permanente
  - **Instagram**: Page ID, User ID, Page Access Token, Page Name (reuso do formulário existente em `ChatChannelsConfig`)
  - **WebChat**: link para `webchat_config` existente ou campos inline
- Edição e exclusão de provedores

**Componentes:**
- `src/pages/configuracoes/components/ProviderCard.tsx`
- `src/pages/configuracoes/components/ProviderFormDialog.tsx`
- `src/pages/configuracoes/hooks/useQueueProviders.ts` (CRUD direto na tabela `queue_providers`)

### Fase 3: Novo Fluxo de Criação de Filas (Wizard)

Substituir o `QueueFormDialog` atual por um wizard multi-step:

**Step 1 - Escolha do Canal:**
- 4 cards visuais (UaZapi, WABA, WebChat, Instagram) com ícone e descrição
- Cada card mostra se há provedor configurado ou não
- Se não houver provedor, exibe alerta para configurar primeiro

**Step 2 - Configuração específica por tipo:**
- **UaZapi**: Seleciona provedor UaZapi configurado + digita nome da instância (evo_instance)
- **WABA**: Seleciona provedor WABA configurado + inicia conexão (seleciona phone number disponível via API Meta)
- **WebChat**: Seleciona provedor WebChat ou cria config inline (widget title, cores, etc.)
- **Instagram**: Seleciona provedor Instagram configurado, valida conexão

**Step 3 - Nome e confirmação:**
- Nome da fila, revisão dos dados, botão criar

O `QueueFormDialog` em modo edição mantém o formulário atual simplificado.

### Fase 4: Integração e Rota

- Adicionar rota `/configuracoes` no `App.tsx`
- Registrar módulo "Configurações" no menu via `useEnsureFilasModule` (ou hook separado)
- Na `FilasPage`, ao criar fila, carregar provedores disponíveis para preencher credenciais automaticamente
- Ao criar fila via wizard, as credenciais do provedor selecionado são copiadas para a tabela `queues`

### Arquivos Modificados/Criados

| Ação | Arquivo |
|---|---|
| Migração | `queue_providers` table |
| Novo | `src/pages/configuracoes/ConfiguracoesPage.tsx` |
| Novo | `src/pages/configuracoes/components/ProviderCard.tsx` |
| Novo | `src/pages/configuracoes/components/ProviderFormDialog.tsx` |
| Novo | `src/pages/configuracoes/hooks/useQueueProviders.ts` |
| Novo | `src/pages/agente/filas/components/QueueWizardDialog.tsx` |
| Editado | `src/pages/agente/filas/FilasPage.tsx` (usar wizard) |
| Editado | `src/App.tsx` (adicionar rota `/configuracoes`) |
| Editado | `src/hooks/useEnsureFilasModule.ts` (registrar módulo Configurações) |

### Detalhes Técnicos

- `useQueueProviders` faz CRUD direto via `supabase.from('queue_providers')` sem edge function
- O wizard carrega provedores via `useQueueProviders` e passa credenciais para `queue-management` create
- A tabela `queue_providers` é independente da `queues` -- provedores são templates de credenciais
- Provedores não podem ser excluídos se houver filas ativas usando suas credenciais

