# Corrigir erro "Rendered more hooks than during the previous render"

## Problema

O componente `DealDetailsSheet` está quebrando com:
> Rendered more hooks than during the previous render.

### Causa raiz

Em `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`, há um **early return** na linha 144:

```ts
if (!deal) return null;
```

Esse return acontece **antes** de hooks declarados mais abaixo no componente:
- `useMemo(...)` em torno da linha 169 (`otherBoardIds`)
- `useEffect(...)` em torno da linha 170 (pré-carrega contagem de etapas dos boards)
- e provavelmente outros hooks abaixo no arquivo (1023 linhas)

Quando `deal` alterna entre `null` e um objeto válido (ex.: ao abrir/fechar o sheet, ou ao trocar de card), o React conta números diferentes de hooks entre renders e dispara o crash.

Isso viola a **Regra dos Hooks** do React: todos os hooks devem ser chamados na mesma ordem em todo render, sem `return`/`if` antes deles.

## Solução

Mover o early return de `deal` para **depois** de todos os hooks do componente.

### Passos

1. Em `DealDetailsSheet.tsx`:
   - Remover `if (!deal) return null;` da linha 144.
   - Tornar todos os derivados de `deal` (priorityConfig, statusConfig, sortedStages, otherBoards, etc.) seguros para `deal === null` usando optional chaining / fallback (`deal?.priority`, `deal?.id`, `deal?.board_id`, etc.).
   - Ajustar os hooks que dependem de `deal` para tratar o caso nulo (já é o caso de `useCRMDealHistory({ dealId: open && deal ? deal.id : null })`).
   - Após o último hook do componente, adicionar:
     ```ts
     if (!deal) return null;
     ```
2. Verificar (com leitura do restante do arquivo) que nenhum outro `return` antecipado, `if`, `&&` ou loop esteja envolvendo chamadas a hooks. Mover qualquer hook restante para o topo.

3. Smoke test no preview:
   - Abrir um card no CRM Builder.
   - Fechar e reabrir.
   - Trocar entre cards diferentes.
   - Expandir o bloco "Quadro" para garantir que `useEffect` de contagem de etapas roda sem erro.

## Arquivos afetados

- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` (única alteração necessária)

## Risco

Baixo. É uma correção pontual de ordenação de hooks, sem mudança de UX nem de lógica de negócio.
