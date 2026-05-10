## Objetivo

Ajustar três pontos no header do `ChatList`:

1. Padronizar a fonte do filtro **Atendentes** com a do filtro **Filas**.
2. Converter o filtro **Filas** num combobox com busca, igual ao padrão usado em **Atendentes** (`TeamMemberSelect`).
3. Tornar a **busca de atendimento** manual: só dispara ao clicar no botão de lupa que ficará dentro do próprio campo (ou ao pressionar Enter).

Tudo é UI/presentation em `src/components/chat/ChatList.tsx`. Sem mudanças de regra de negócio, schema ou contexto.

---

## 1) Fonte do filtro Atendentes = filtro Filas

- Hoje:
  - Filas (`Select` shadcn): trigger `h-8 text-xs`, item `text-sm` por padrão.
  - Atendentes (`TeamMemberSelect`, prop `size="sm"`): trigger `h-8` mas labels internos `text-sm`.
- Ação: aplicar `text-xs` ao label visível do trigger do `TeamMemberSelect` e seguir usando `size="sm"`. Como o componente é compartilhado, fazer isso pelo `className` recebido (já é passado pelo ChatList) — adicionar suporte para `text-xs` herdado, ou simplesmente sobrescrever via `className="w-full text-xs"` + ajuste local na render do trigger para usar `text-xs` quando a className inclui `text-xs`.
  - Implementação mais segura: no `TeamMemberSelect`, trocar os `text-sm` dos labels do trigger (linhas ~165, 170, 175, 180, 185) por `text-xs` quando `size === 'sm'`. Isso mantém consistência com o padrão visual usado no chat e não afeta os usos `size="md"` em outras telas.

## 2) Filas com padrão de combobox + busca

Substituir o `<Select>` atual de filas por um `Popover` + `Command` (mesmo padrão de `AgentSearchSelect` / `TeamMemberSelect`).

Comportamento:
- Trigger: botão `outline` `h-8 text-xs`, com ícone `Layers`, label da fila selecionada (ou "Todas as filas") e `ChevronsUpDown`.
- Popover (`align="start"`, `w-[280px]`):
  - `CommandInput placeholder="Buscar fila…"`.
  - Item fixo no topo: **"Todas as filas"** (limpa seleção).
  - Lista de `activeQueues` ordenada alfabeticamente, exibindo o nome e o `channelBadge(queue.channel_type)` à direita.
  - Seleção fecha o popover e aciona o mesmo `setSelectedQueue(...)` já usado hoje (mantém o objeto enxuto: id, name, channel_type, hub, evo_url, evo_apikey, evo_instance).

Manter o grid `grid-cols-2 gap-2` para Filas + Atendentes lado a lado.

## 3) Busca de atendimento manual com botão dentro do campo

Hoje: `Input` controla `searchQuery` do contexto a cada keystroke (filtragem reativa).

Comportamento novo:
- Estado **local** `searchDraft` no `ChatList` para controlar o `Input`.
- O contexto (`searchQuery` via `setSearchQuery`) só é atualizado quando o usuário:
  - Clicar no botão de lupa que fica **dentro** do campo (à direita), ou
  - Pressionar **Enter** no input.
- Ao limpar o campo (botão X opcional), `setSearchQuery('')` deve ser chamado para restaurar a lista completa.
- Sincronizar `searchDraft` com `searchQuery` no mount para casos em que o contexto já tinha valor.

UI:
- Remover o ícone `Search` da esquerda.
- Manter `Input` com `placeholder="Buscar atendimento"` e padding direito (`pr-10`) suficiente para o botão.
- Botão `Search` (`variant="ghost"`, `size="icon"`, `h-7 w-7`) absoluto à direita dentro do wrapper relativo, executando `setSearchQuery(searchDraft.trim())`.
- Quando há texto no `searchDraft` ou em `searchQuery`, mostrar um `X` (segundo botão) à esquerda do botão de busca para limpar; opcional mas recomendado para reverter ao estado padrão.

Os botões já existentes ao lado do input (Ordenar, Métricas, Configurações) permanecem fora do campo, como hoje.

---

## Detalhes técnicos

- Arquivo único: `src/components/chat/ChatList.tsx`.
- Para o item 1 também editar `src/components/TeamMemberSelect.tsx` substituindo `text-sm` por `text-xs` apenas quando `size === 'sm'` no trigger.
- Imports a adicionar em `ChatList.tsx`: `Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem` de `@/components/ui/command`. `Search` já está importado.
- Remover do JSX o `<Select>`/`<SelectTrigger>`/`<SelectContent>`/`<SelectItem>` da fila (não remover dos imports caso ainda sejam usados em outro ponto do arquivo — verificar antes).
- Não alterar `WhatsAppDataContext` nem hooks — apenas o ponto onde `setSearchQuery` é chamado.

## Fora de escopo

- Nenhuma mudança nas abas, contadores, filtros de modo/etapas ou na listagem de conversas.
- Nenhum ajuste de backend, RLS ou tipos.
