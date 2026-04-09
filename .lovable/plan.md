

# Monitoramento de Grupos — Busca, Inclusão/Exclusão, Gravação Inteligente e Auto-discovery

## Resumo

Transformar a aba Grupos do Assistente de Suporte em um sistema completo de monitoramento: busca, toggle de monitoramento por grupo, gravação seletiva de mensagens (com categorização cliente/suporte e transcrição de áudios), e auto-discovery noturno de novos grupos "Julia".

## 1. Migração: tabela `support_monitored_groups`

```sql
CREATE TABLE public.support_monitored_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid text NOT NULL UNIQUE,
  group_name text NOT NULL DEFAULT '',
  picture_url text,
  is_active boolean NOT NULL DEFAULT true,
  auto_added boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.support_monitored_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on support_monitored_groups" ON public.support_monitored_groups FOR ALL USING (true) WITH CHECK (true);
```

Também adicionar colunas em `support_group_messages`:
```sql
ALTER TABLE public.support_group_messages
  ADD COLUMN IF NOT EXISTS sender_role text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS is_transcribed boolean DEFAULT false;
```

## 2. UI — Aba Grupos redesenhada (`SupportGroupsTab.tsx`)

- **Campo de busca** no topo filtrando por nome do grupo
- **Ícone toggle (Eye/EyeOff)** em cada grupo para incluir/remover do monitoramento
  - Ao adicionar: insert em `support_monitored_groups`
  - Ao remover: delete da tabela (com confirmação simples)
- **Badge visual** "Monitorando" nos grupos ativos
- **Contador** separado: "X monitorados / Y total"
- Ao carregar, cruzar lista de grupos da API com `support_monitored_groups` para saber quais estão ativos
- Botão "Monitorar Todos" para inclusão em massa

## 3. Webhook — Gravação seletiva e categorização

Alterar `support-assistant-webhook/index.ts`:

1. **Verificar se grupo está monitorado**: antes de gravar, consultar `support_monitored_groups` pelo `group_jid`. Se não estiver, ignorar (skip)
2. **Categorizar sender_role**: cruzar `sender_jid` / `PhoneNumber` com `support_team_members` para definir `sender_role = 'suporte'` ou `'cliente'`
3. **Tipos de mídia**: para documentos/fotos/vídeos, gravar `message_text` descritivo (ex: "📄 Documento enviado pelo cliente", "📷 Imagem enviada pelo suporte João")
4. **Áudio**: marcar `is_transcribed = false` e `message_text = '🎤 Áudio aguardando transcrição'`. Disparar transcrição assíncrona via edge function separada

## 4. Edge Function — Transcrição de áudios (`support-transcribe-audio`)

Nova edge function que:
1. Busca mensagens com `message_type = 'audio'` e `is_transcribed = false`
2. Baixa o áudio via `media_url`
3. Transcreve usando Lovable AI (enviar como base64 para modelo multimodal)
4. Atualiza `transcription` e `is_transcribed = true`
5. Será chamada via pg_cron a cada 5 minutos

## 5. Edge Function — Auto-discovery noturno (`support-group-discovery`)

Nova edge function agendada via pg_cron (todo dia às 23:00 BRT):

1. Buscar `support_assistant_config` para credenciais
2. Chamar `GET /group/list` via UaZapi
3. Para cada grupo, verificar se já existe em `support_monitored_groups`
4. Se novo E nome contém variações de "julia"/"júlia" (case-insensitive, com/sem acento): inserir automaticamente com `auto_added = true`
5. Logar quantidade de novos grupos adicionados

Regex de match: `/j[uú]lia/i`

## 6. Inclusão inicial de todos os grupos

Na primeira execução (ou via botão "Monitorar Todos" na UI), inserir todos os grupos existentes em `support_monitored_groups` com `auto_added = false`.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `support_monitored_groups` + colunas extras em `support_group_messages` |
| `SupportGroupsTab.tsx` | Busca, toggle monitoramento, badges, botão monitorar todos |
| `support-assistant-webhook/index.ts` | Filtro por grupos monitorados, categorização sender_role, descrição de mídias |
| `supabase/functions/support-transcribe-audio/index.ts` | Nova — transcrição de áudios via Lovable AI |
| `supabase/functions/support-group-discovery/index.ts` | Nova — auto-discovery noturno de grupos Julia |
| SQL (insert tool) | Criar cron jobs para transcrição (5min) e discovery (23:00 BRT) |

## Detalhes técnicos

- O webhook atual grava TODAS as mensagens de grupo — será alterado para gravar apenas grupos monitorados
- A categorização usa a mesma lógica de `PhoneNumber` + cruzamento com `support_team_members` já implementada na UI
- Para transcrição, o áudio é baixado via `media_url` do UaZapi e enviado ao Lovable AI Gateway como multimodal
- O pg_cron do discovery usa timezone `America/Sao_Paulo` para executar às 23h BRT

