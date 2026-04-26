## Objetivo
Fazer com que mover um card para outra etapa por arrastar e soltar salve de forma confiável no backend e mantenha o placeholder visual entre os cards da coluna destino.

## Diagnóstico
O placeholder visual já está parcialmente implementado (`previewMove` + opacidade do card), mas a persistência ainda falha porque o `handleDragEnd` depende do estado `deals` renderizado no componente para descobrir a posição final.

Hoje o fluxo está assim:
```text
handleDragOver -> previewMove(setDeals)
                 -> React agenda re-render
handleDragEnd  -> lê deals do render atual
                 -> às vezes ainda enxerga a etapa antiga
                 -> moveDeal recebe from/to incorretos
                 -> backend não salva a troca real de etapa
```

Em outras palavras: o preview visual pode acontecer, mas o commit final ainda pode usar dados antigos da renderização anterior.

## Plano de implementação

### 1) Tornar o destino do drag fonte única da verdade no `BoardPage.tsx`
- Criar um `dragPreviewRef` com:
  - `dealId`
  - `toPipelineId`
  - `toIndex`
- Atualizar esse ref dentro de `handleDragOver` sempre que o alvo mudar.
- Continuar chamando `previewMove` para manter a sombra/placeholder visual na coluna destino.

### 2) Parar de depender do array `deals` para descobrir o destino final
- Em `handleDragEnd`, usar primeiro o valor salvo em `dragPreviewRef.current`.
- Só usar `deals` como fallback se não houver preview registrado.
- Passar para `moveDeal` exatamente o destino calculado no drag, sem recalcular a etapa final a partir do estado renderizado.

### 3) Limpar corretamente o estado transitório do drag
- Resetar `dragPreviewRef` em:
  - `handleDragStart`
  - `handleDragEnd`
  - `handleDragCancel`
- Manter `dragOriginPipelineRef` apenas para a etapa de origem.
- Garantir que um drag cancelado faça `fetchDeals()` e descarte qualquer preview pendente.

### 4) Reforçar a coerência visual do placeholder
- Preservar o `previewMove` atual, que já injeta o card na coluna destino durante o arrasto.
- Ajustar o cálculo do índice alvo em `handleDragOver` para evitar microoscilações ao passar sobre cards da coluna destino.
- Manter o card original semitransparente e o overlay opaco, para a sombra de posicionamento continuar clara.

### 5) Validar o fluxo completo de persistência
- Testar estes cenários:
  - mover para outra etapa com cards no meio da coluna
  - mover para o fim da coluna
  - mover para coluna vazia
  - cancelar arrasto
  - sair e voltar ao painel após mover
- Confirmar que o card permanece na nova etapa após recarregar os dados.

## Arquivos a ajustar
- `src/pages/crm-builder/BoardPage.tsx`
- `src/pages/crm-builder/hooks/useCRMDeals.ts` (apenas se precisar pequeno ajuste de compatibilidade com o commit final)
- `src/pages/crm-builder/components/deals/DealCard.tsx` (somente se for necessário um refinamento visual)

## Detalhes técnicos
- O problema principal não parece mais ser o realtime: o hook já tem guarda com `isMovingRef` e debounce.
- O ponto mais frágil agora é a leitura do destino final no `handleDragEnd` a partir de estado sujeito a atraso de renderização.
- A correção vai fazer o commit usar o alvo calculado pelo próprio DnD, não um snapshot potencialmente antigo do React.
- Isso mantém o comportamento visual atual e corrige a gravação real da mudança de etapa.