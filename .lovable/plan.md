## Ajustes na lista de conversas do /chat

### 1. `src/components/chat/ChatContactItem.tsx`

**Linha CRM Builder — alinhar etapa à direita (estilo Julia):**
- Reestruturar o bloco `crmBuilderLink` para usar `flex items-center justify-between` (igual à linha Julia).
- Lado esquerdo: badge `CRM` (azul) + nome do Quadro (`boardName`) em fonte mono/discreta, igual ao `#cod_agent · alias`.
- Lado direito: badge da etapa (`pipelineName`) como pill colorido com `backgroundColor: pipelineColor`, mesmo formato do `stageName` na linha Julia (`text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white`).
- Remover o pipeline inline do meio do texto.

**Tooltips nas linhas Julia e CRM:**
- Envolver a linha Julia inteira em `<Tooltip>` com `<TooltipContent>` mostrando:
  - "Agente Julia"
  - `Código: #{agentCodAgent}`
  - `Alias: {agentAlias}` (se houver)
  - `Etapa CRM Julia: {stageName}` (se houver)
- Envolver a linha CRM Builder em `<Tooltip>` com `<TooltipContent>` mostrando:
  - "Vinculado ao CRM Builder"
  - `Quadro: {boardName}`
  - `Etapa: {pipelineName}`
- Usar `TooltipProvider` já importado; `delayDuration={200}`.

**Separador entre cards:**
- Adicionar `border-b border-border/50` na raiz do `div` clicável (ou usar `divide-y` no container pai — preferir borda no item para não interferir no virtualizer).
- Manter o `border-l-[4px]` existente para seleção.

### 2. Sem alterações em
- `useCRMBuilderLinkedConversations` (já retorna `pipelineColor`).
- `ChatList.tsx` (props já passadas).
- `JuliaStatusBadge`, `SlaBadge`, `PriorityBadge`.

### Detalhes técnicos
- `Tooltip` do Radix já está importado no arquivo (`Tooltip`, `TooltipContent`, `TooltipTrigger`, `TooltipProvider`).
- O `TooltipTrigger` deve usar `asChild` envolvendo o `<div>` da linha para preservar o layout flex.
- Manter `React.memo` — props não mudam de identidade entre renders.
- Não criar novas queries; reutilizar dados já presentes em props.
