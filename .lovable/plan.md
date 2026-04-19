

## Objetivo
Aumentar a largura do sidebar de conversas em ~30% e torná-la responsiva, mantendo **tempo** e **badge de não-lido** sempre fixados à direita, com nome truncado dinamicamente (sem corte fixo de 35 chars) para nunca estourar o limite.

## Análise

**Hoje** (`ChatContainer.tsx`):
- `w-full lg:w-[400px] lg:max-w-[400px]` — fixo em 400px no desktop.

**Hoje** (`ChatContactItem.tsx`):
- Nome truncado por JS em 35 chars (`contact.name.slice(0, 35)`) — corte estático que ignora largura real.
- `flex items-center justify-between` já posiciona tempo à direita, mas o `<span>` do nome com `truncate flex-1` deveria funcionar — o slice manual está sobrando.

## Mudanças

### 1. `src/components/chat/ChatContainer.tsx` — largura responsiva (+30%)
- Trocar `lg:w-[400px] lg:max-w-[400px]` por escala fluida:
  - `lg:w-[440px]` (≈ 400 × 1.10, base mínima)
  - `xl:w-[500px]` (≈ 400 × 1.25)
  - `2xl:w-[560px]` (≈ 400 × 1.40, pico em telas grandes — média ~30%)
- Manter `flex-shrink-0` para não colapsar.

### 2. `src/components/chat/ChatContactItem.tsx` — truncamento dinâmico via CSS
- **Remover** o slice manual de 35 caracteres no nome.
- Usar puro CSS: `truncate min-w-0 flex-1` (já presente) — deixa o navegador cortar no pixel certo conforme largura disponível.
- Garantir wrapper externo com `min-w-0 overflow-hidden` (já está) para que `flex-1` respeite o limite do pai.
- **Tempo** (`formattedTime`): manter `flex-shrink-0 whitespace-nowrap` à direita — sem mudanças.
- **Badge não-lido**: já é `flex-shrink-0` — sem mudanças.
- Confirmar que a row de tags (fila/SLA/atribuído) também respeita `flex-nowrap min-w-0 overflow-hidden` (já está).

## Arquivos
- `src/components/chat/ChatContainer.tsx` — larguras responsivas lg/xl/2xl.
- `src/components/chat/ChatContactItem.tsx` — remover slice de 35 chars; deixar CSS truncar dinamicamente.

## Validação
1. Em viewport 1852px (atual): sidebar deve ficar ~560px, nomes longos truncam com `…` exatamente antes do tempo.
2. Em viewport 1280px: sidebar ~440px, mesmo comportamento.
3. Tempo (`há X minutos`) e badge de não-lido sempre visíveis e colados à direita.
4. Nenhum elemento da lista deve causar scroll horizontal ou empurrar o painel de chat.

