

## Plano: Impedir que nomes longos empurrem ícones para fora do card

### Problema
O container do nome não tem restrição de largura mínima, então nomes longos expandem o flex item e empurram os ícones de ação para fora do card.

### Solução
Adicionar `min-w-0 overflow-hidden` no container do nome (linha 117) para que o flexbox respeite o espaço disponível e o `line-clamp-1` funcione corretamente.

### Alteração

**`src/pages/crm/components/CRMLeadCard.tsx`** — linha 117:
```tsx
// De:
<div className="flex flex-col gap-0.5">

// Para:
<div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
```

Isso garante que o texto trunca com ellipsis em vez de expandir o container.

