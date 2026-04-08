

# Plano: Módulo Assistente de Suporte

## Resumo

Criar o módulo "Assistente de Suporte" na categoria SISTEMA. Inclui página com aba de configuração para conexão UaZapi, webhook para receber mensagens de grupos, tabela para armazenar conversas, e hook de registro automático do módulo.

## 1. Migração: tabelas Supabase

```sql
-- Configuração da assistente de suporte
CREATE TABLE support_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  api_url text,
  api_key text,
  instance_token text,
  connection_status text DEFAULT 'disconnected',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE support_assistant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on support_assistant_config" ON support_assistant_config FOR ALL USING (true) WITH CHECK (true);

-- Mensagens de grupos capturadas
CREATE TABLE support_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  group_jid text NOT NULL,
  group_name text,
  sender_jid text,
  sender_name text,
  message_id text,
  message_type text DEFAULT 'text',
  message_text text,
  media_url text,
  is_from_me boolean DEFAULT false,
  raw_payload jsonb,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE support_group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on support_group_messages" ON support_group_messages FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_support_group_messages_group ON support_group_messages(group_jid);
CREATE INDEX idx_support_group_messages_ts ON support_group_messages(timestamp);
```

## 2. Tipo `ModuleCode`

Adicionar `'support_assistant'` ao union type em `src/types/permissions.ts`.

## 3. Hook `useEnsureSupportAssistantModule`

Criar `src/hooks/useEnsureSupportAssistantModule.ts` seguindo o padrão dos demais hooks (ex: `useEnsureCrmComercialModule`):
- Código: `support_assistant`
- Nome: `Assistente de Suporte`
- Categoria: `sistema`
- Grupo menu: `SISTEMA`
- Rota: `/suporte-assistente`
- Icone: `HeadphonesIcon` ou `Headset`
- display_order: 80

## 4. Registrar hook no Sidebar

Importar e chamar `useEnsureSupportAssistantModule()` em `src/components/layout/Sidebar.tsx`.

## 5. Página principal

Criar `src/pages/suporte-assistente/SupportAssistantPage.tsx`:
- Tabs: **Configuração** | (futuras abas)
- Aba Configuração:
  - Formulário com campos: URL da API, API Key, Nome da Instância
  - Botão "Criar Instância" (via `uazapi-admin` existente)
  - QR Code para conectar WhatsApp
  - Status de conexão (conectado/desconectado)
  - Salva configuração na tabela `support_assistant_config`

## 6. Edge Function: `support-assistant-webhook`

Criar `supabase/functions/support-assistant-webhook/index.ts`:
- Recebe eventos da instância UaZapi conectada
- Filtra apenas mensagens de **grupo** (`isGroup` ou `remoteJid` contendo `@g.us`)
- Extrai: group_jid, group_name, sender, message_text, message_type, media_url
- Grava na tabela `support_group_messages`
- Ignora mensagens individuais (não grupo)
- `verify_jwt = false` no config.toml

## 7. Rota no App.tsx

Adicionar:
```tsx
<Route path="/suporte-assistente" element={
  <ProtectedRoute module="support_assistant">
    <SupportAssistantPage />
  </ProtectedRoute>
} />
```

## 8. Config.toml

```toml
[functions.support-assistant-webhook]
verify_jwt = false
```

## Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabelas `support_assistant_config` e `support_group_messages` |
| `src/types/permissions.ts` | Adicionar `support_assistant` ao `ModuleCode` |
| `src/hooks/useEnsureSupportAssistantModule.ts` | Novo hook de registro do módulo |
| `src/components/layout/Sidebar.tsx` | Importar e chamar o novo hook |
| `src/pages/suporte-assistente/SupportAssistantPage.tsx` | Página principal com aba Configuração |
| `supabase/functions/support-assistant-webhook/index.ts` | Webhook para capturar mensagens de grupo |
| `supabase/config.toml` | Bloco para o webhook |
| `src/App.tsx` | Rota protegida |

