## Objetivo

Em `TeamMemberSelect` (usado em Transferir conversa, filtro de atendentes do /chat, etc.), exibir o status de presença de cada membro e ordenar:
1. Online (verde) — ordem alfabética
2. Ausente (âmbar) — ordem alfabética
3. Offline (cinza) — ordem alfabética

## Mudanças

### `src/components/TeamMemberSelect.tsx`
- Importar `useTeamHeartbeat` (`src/hooks/useTeamHeartbeat.ts`), que já entrega `is_online` / `is_away` calculados pelo servidor por `client_id` do usuário logado.
- Substituir o `sortedMembers` por um `sortedMembers` que:
  - Calcula `status` por membro: `online` se `isOnline(id)`, `away` se `isAway(id)`, senão `offline`.
  - Ordena por prioridade (online=0, away=1, offline=2) e em seguida `localeCompare` por nome (pt-BR).
- Renderizar um indicador de status no item da lista (dot pequeno sobre o avatar) e um badge de texto sutil ("Online" / "Ausente" / "Offline") à direita, antes do badge de role.
  - Cores via tokens: verde (`bg-emerald-500`), âmbar (`bg-amber-500`), cinza (`bg-muted-foreground/40`).
- Não exibir indicador nos atalhos ("Atribuir a mim", "Sem responsável", extras).

### Sem outras mudanças
- Hook `useTeamHeartbeat` já faz refetch a cada 30s + realtime; sem necessidade de novas queries.
- `useTeamByClient` continua a única fonte de membros.
- Não mexer em consumidores (`TransferDialog`, `ChatList`, etc.) — passam a herdar o novo visual e ordenação automaticamente.

## Detalhes técnicos

- IDs em `TeamMemberOption.id` podem ser `string|number`; converter com `Number(m.id)` para consultar `useTeamHeartbeat`.
- Ordenação estável: usar `.map` para anexar `status`, `.sort`, depois usar a lista resultante na renderização (mantendo a contagem de `sortedMembers.length`).
