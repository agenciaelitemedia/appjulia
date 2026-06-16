## Objetivo

Transformar `/mensagens-rapidas` em um gerenciador completo de respostas prontas para o Chat, com suporte a múltiplos tipos de conteúdo (texto, áudio, vídeo, imagem, documento, link com preview) e variáveis dinâmicas resolvidas no momento da seleção. Remover a noção de "onde usar" — toda mensagem rápida passa a ser usada exclusivamente no Chat.

## Mudanças no banco (nova migration)

Adicionar colunas à tabela `quick_messages`:

- `kind text not null default 'text'` — um de `text | image | video | audio | document | link`
- `media_url text` — URL pública do anexo no bucket `chat-media` (subpasta `quick-messages/<user_id>/...`)
- `media_path text` — caminho interno no bucket (para deletar quando a mensagem for removida)
- `media_mime text`, `media_size bigint`, `media_filename text`
- `link_url text`, `link_title text`, `link_description text`, `link_image text` — metadados do preview de link

`use_locations` deixa de ser usado pela UI mas permanece na tabela por compatibilidade. Default passa a `{chat_module}` para registros novos.

Bucket de mídia: reutilizar `chat-media` (já existe e é público). Sem mudança de policies.

## Engine de variáveis (`src/lib/messageVariables.ts`)

Todas as variáveis usam sintaxe `{{...}}`. Expandir `interpolateVariables`:

- `{{Saudacao_dia_tarde_noite}}` → "Bom dia" (<12h), "Boa tarde" (12-18h), "Boa noite" (≥18h), no fuso `America/Sao_Paulo`.
- `{{nome}}` → nome do lead (já existe).
- `{{primeiro_nome}}` → primeiro nome (já existe).
- `{{data_hoje}}` → `dd/MM/yyyy`.
- `{{hora_agora}}` → `HH:mm`.
- `{{data_hoje+Xd}}` → data de hoje + X dias corridos no formato `dd/MM/yyyy` (regex `\{\{\s*data_hoje\+(\d+)d\s*\}\}`).
- Mantém `{{protocolo}}`, `{{atendente}}`, `{{data}}`, `{{hora}}` legados.

Atualizar `AVAILABLE_VARIABLES` com os novos tokens. Match exclusivamente em `{{var}}` (chaves duplas).

## Página `/mensagens-rapidas` reformulada

### Lista (cards)

Cada card mostra ícone do tipo, título, atalho, preview (thumbnail para imagem/vídeo, player compacto para áudio, ícone+filename para documento, card de link com og:image, primeiras linhas para texto), badge "Ativo/Inativo", ações editar/excluir.

Remover totalmente a seção/badges de "Onde usar".

### Dialog Criar/Editar

Topo: segmented control com 6 tipos:

```text
[Texto] [Imagem] [Vídeo] [Áudio] [Documento] [Link]
```

Campos comuns: Título, Atalho, Ativo.

Campos por tipo:

- **Texto**: textarea + toolbar de chips que inserem `{{Saudacao_dia_tarde_noite}}`, `{{nome}}`, `{{data_hoje}}`, `{{hora_agora}}`, `{{data_hoje+Xd}}` (com input numérico para X). Pré-visualização renderizada abaixo com valores de exemplo.
- **Imagem / Vídeo / Áudio / Documento**: dropzone + upload, preview, legenda opcional (com as mesmas variáveis). Upload via `supabase.storage.from('chat-media').upload('quick-messages/<user_id>/<uuid>.<ext>')`.
- **Link**: input de URL + botão "Buscar preview" (usa `useLinkPreview`/edge `link-preview` existentes). Campos editáveis após fetch. Legenda opcional.

Validação no Salvar: `text` exige `message_text`; mídia exige `media_url`; `link` exige `link_url`.

### Hook `useQuickMessages`

Adicionar campos novos ao tipo `QuickMessage`. Remover parâmetro/filtro `location` (chat-only). Manter ordenação por `position`.

## QuickMessagePicker (no Chat)

`src/components/chat/QuickMessagePicker.tsx`:

1. Busca mensagens do usuário sem filtro de `use_locations`.
2. Renderiza item conforme `kind` (ícone + preview compacto).
3. Ao clicar:
   - **text**: chama `onSelect(interpolated_text)` — interpolação acontece AQUI (no momento da seleção), conforme pedido. Contexto vem de props novas (`contactName`, `protocol`, `agentName`).
   - **image/video/audio/document**: chama `onSelectMedia({ url, mime, filename, kind, caption })` com legenda já interpolada.
   - **link**: chama `onSelect(interpolated_text + '\n' + link_url)` — WhatsApp gera o preview a partir do URL.

## ChatInput

`handleQuickMessageSelect(text)` continua igual. Adicionar `handleQuickMessageMedia({url, mime, filename, kind, caption})`: `fetch(url)` → `Blob` → `File`, abre o modal `pendingMedia` existente já pré-preenchido. Passar `contactName`, `protocol`, `agentName` como props ao `QuickMessagePicker`.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — alterações em `quick_messages`.
- `src/lib/messageVariables.ts` — novas variáveis em `{{...}}`.
- `src/hooks/useQuickMessages.ts` — tipos novos, remover filtro location.
- `src/pages/mensagens-rapidas/QuickMessagesPage.tsx` — UI reformulada.
- `src/components/chat/QuickMessagePicker.tsx` — render por tipo + interpolação na seleção.
- `src/components/chat/ChatInput.tsx` — handler de mídia rápida e passagem de contexto.

## Fora de escopo

- Backfill de mensagens antigas (todas viram `text` por default).
- Drag-and-drop de reordenação.
