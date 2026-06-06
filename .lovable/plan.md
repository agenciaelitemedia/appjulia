## Objetivo
Mostrar prévia de links (estilo WhatsApp) com título, descrição, imagem e domínio:
1. Nas bolhas de mensagens recebidas e enviadas no histórico do `/chat`.
2. No input enquanto o usuário digita uma URL.

## Estratégia de dados (em ordem)
1. **Metadados nativos do WhatsApp**: quando o payload UaZapi/WABA traz `extendedTextMessage.matchedText` + `title` + `description` + `jpegThumbnail` (Open Graph já resolvido pelo provedor), persistir em `message.metadata.link_preview` no momento do upsert da mensagem.
2. **Fallback**: se a mensagem contém URL mas não tem preview salvo, chamar uma Edge Function própria `link-preview` que faz fetch do HTML, extrai OG/Twitter tags e devolve `{ url, title, description, image, site_name, domain }`. Cacheia em tabela `link_preview_cache` (chave = hash da URL canônica, TTL 30 dias).

## Mudanças

### Backend
- **Migration** `link_preview_cache`: `url_hash text PK`, `url text`, `title`, `description`, `image_url`, `site_name`, `domain`, `fetched_at`, `expires_at`. GRANTs para `authenticated` + `service_role`, RLS permitindo SELECT/INSERT para `authenticated`.
- **Edge Function `link-preview`** (`supabase/functions/link-preview/index.ts`):
  - `POST { url }` → valida URL, normaliza, busca no cache; se vazio/expirado faz `fetch` com `User-Agent` de bot, limite 1MB, timeout 5s, parse via regex de `<meta property="og:*">` / `<meta name="twitter:*">` / `<title>`, resolve URLs relativas, grava no cache e retorna JSON.
  - CORS padrão Lovable. `verify_jwt = true` (default).

### Frontend
- **Tipo** `MessageMetadata.link_preview?: { url; title?; description?; image?; site_name?; domain? }` em `src/types/chat.ts`.
- **Persistência de metadados nativos**: em `WhatsAppDataContext` / mapeador de mensagens UaZapi (onde lemos `extendedTextMessage`), copiar `title`, `description`, `canonicalUrl`/`matchedText`, `jpegThumbnail` (base64) para `metadata.link_preview` quando presentes.
- **Hook `useLinkPreview(url)`** (`src/hooks/useLinkPreview.ts`):
  - React Query com chave `['link-preview', url]`, `staleTime` 24h.
  - Chama edge function `link-preview` via `supabase.functions.invoke`.
  - Cache LRU em memória (Map) por sessão para evitar refetch.
- **Util `extractFirstUrl(text)`** em `src/lib/chat/linkPreview.ts` (regex única, ignora URLs dentro de markdown de código).
- **Componente `LinkPreviewCard`** (`src/components/chat/LinkPreviewCard.tsx`):
  - Card compacto estilo WhatsApp: borda esquerda colorida, imagem (se houver) no topo ou à direita, título bold 2 linhas, descrição 2 linhas muted, domínio pequeno.
  - Estados: skeleton enquanto carrega; se erro/sem dados, não renderiza nada.
  - Usa tokens do design system (sem cores hardcoded).
  - Clique abre `window.open(url, '_blank', 'noopener')`.
- **MessageBubble**: depois do texto e antes do timestamp, renderizar `LinkPreviewCard`:
  - Se `message.metadata?.link_preview` existir → usar direto.
  - Senão, se `extractFirstUrl(message.text)` retornar URL → chamar `useLinkPreview`.
  - Apenas para mensagens `type === 'text'` (não em mídia).
- **ChatInput**: ao digitar, debounce 600ms sobre `extractFirstUrl(input)`; quando URL muda, render `LinkPreviewCard` acima do textarea. Botão "X" para descartar (suprime para essa URL durante o ciclo de digitação).

## Detalhes técnicos
- Normalização de URL: lowercase host, remove fragmento `#`, mantém query.
- Hash da URL para `url_hash`: `sha256(url_normalizada)`.
- Limite: máx 1 preview por mensagem (primeiro link).
- Segurança: edge function bloqueia esquemas != http/https, IPs privados (SSRF), respeita Content-Type `text/html`.
- Sem alteração em `last_message_text` da ChatList (escopo definido).

## Arquivos novos
- `supabase/migrations/<ts>_link_preview_cache.sql`
- `supabase/functions/link-preview/index.ts`
- `src/lib/chat/linkPreview.ts`
- `src/hooks/useLinkPreview.ts`
- `src/components/chat/LinkPreviewCard.tsx`

## Arquivos editados
- `src/types/chat.ts` (campo `link_preview` em `MessageMetadata`)
- `src/components/chat/MessageBubble.tsx` (render do card no texto)
- `src/components/chat/ChatInput.tsx` (render do card sobre o input)
- `src/contexts/WhatsAppDataContext.tsx` (capturar metadados nativos do WhatsApp para `link_preview`)
