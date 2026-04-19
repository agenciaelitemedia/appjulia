
## Objetivo
Replicar o comportamento do WhatsApp Web na lista de conversas: hora e badge de não-lidas (lado direito) sempre 100% visíveis; nome do lead e preview da mensagem truncam dinamicamente conforme o espaço disponível no sidebar — sem corte por contagem fixa de caracteres.

## Diagnóstico do estado atual (`ChatContactItem.tsx`)
1. **Truncamento por caractere fixo (35)**: `contact.name.slice(0, 35)` ignora a largura real → em sidebars estreitos ainda estoura; em largos, corta cedo demais.
2. **`MessagePreview` com `MAX_CHARS = 45`**: mesmo problema — corte arbitrário.
3. **Linha 3 (pills fila/SLA/atribuído) com `flex-nowrap`**: força largura da linha 1/2 e empurra hora/badge para fora em alguns casos (visível na imagem 2 — "há 7 ho..." truncado).
4. Falta garantir `min-width: 0` em ancestrais para o `truncate` do CSS funcionar de fato.

## Correções (apenas `src/components/chat/ChatContactItem.tsx`)

### 1. Remover cortes por caractere
- Nome: renderizar `{contact.name}` direto, deixar o CSS truncar.
- `MessagePreview`: remover `MAX_CHARS`, renderizar texto completo com `truncate`.

### 2. Garantir prioridade visual lado direito
- Linha 1: `<span hora>` com `flex-shrink-0` (já tem) + nome com `flex-1 min-w-0 truncate`.
- Linha 2: badge não-lidas com `flex-shrink-0` + preview com `flex-1 min-w-0 truncate`.
- Linha 3 (pills): trocar `flex-nowrap` por `flex-wrap` OU manter nowrap mas com `overflow-hidden` + `min-w-0` no contêiner pai — assim pills excedentes somem em vez de empurrar layout.

### 3. Reforçar contexto flex
- Já existe `min-w-0 overflow-hidden` no wrapper de conteúdo — manter.
- Confirmar que o `<button>` raiz tem `min-w-0` (tem).

## Arquivo
- `src/components/chat/ChatContactItem.tsx` — apenas ajustes de classes Tailwind e remoção das duas truncagens por contagem.

## Validação
1. Sidebar atual (~400px): nomes longos como "AutoNext - Gestores de Automaç..." truncam com `…` mas hora "08:29" e badge ficam visíveis.
2. "Garagem - Open Source" mostra "há 7 horas" completo (não "há 7 ho...").
3. Redimensionar viewport: truncamento responde dinamicamente, lado direito nunca some.
4. Mensagens de mídia (foto/vídeo/áudio) continuam com ícone + label.
