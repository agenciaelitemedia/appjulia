## Objetivo

Aplicar no filtro **"Filtrar atendentes"** da aba Desempenho (`EquipePerformanceTab`) o mesmo visual usado no filtro de respons\u00e1veis do chat (`TeamMemberSelect`), mantendo o comportamento de **multi-sele\u00e7\u00e3o**.

## Por que

Hoje o `UserMultiSelect` mostra apenas nome + checkbox. O chat usa `TeamMemberSelect` com busca, avatar com iniciais coloridas, badge de papel (Admin / Propriet\u00e1rio / Advogado / etc.) e indicador de online \u2014 muito mais informativo e consistente.

## Plano

Editar **`src/pages/equipe/components/EquipePerformanceTab.tsx`**, no componente local `UserMultiSelect`:

1. **Manter** a assinatura externa (`members`, `selected`, `onChange`) e o trigger (`Button` com \u00edcone Filter + label "Todos atendentes" / "N selecionado(s)").
2. **Trocar o conte\u00fado do Popover** por um `Command` (mesmos prim\u00edrios do `TeamMemberSelect`):
   - `CommandInput` para buscar por nome/email.
   - `CommandList` + `CommandGroup` listando os membros.
   - Cada `CommandItem`:
     - `Avatar` com foto ou iniciais (paleta determin\u00edstica por nome, igual `TeamMemberSelect`).
     - Nome + email (truncado).
     - `Badge` de papel (cores semelhantes ao chat).
     - Ponto verde de online via `useTeamHeartbeat`.
     - `Check` esquerdo indicando sele\u00e7\u00e3o (no lugar do checkbox).
     - `onSelect` faz toggle no array `selected` (multi).
3. **Cabe\u00e7alho do popover** mantido com t\u00edtulo "Filtrar atendentes" + bot\u00e3o "Limpar" quando houver sele\u00e7\u00e3o.
4. **Rodap\u00e9** opcional com bot\u00e3o "Selecionar todos" / "Aplicar".
5. Largura do popover ajustada (`w-80`) para acomodar avatar + badge.

## Detalhes t\u00e9cnicos

- Reutilizar helpers visuais copiando o m\u00ednimo do `TeamMemberSelect.tsx` (paleta de avatar, `ROLE_LABEL`, `ROLE_BADGE_CLASS`) \u2014 sem refator de `TeamMemberSelect` (que \u00e9 single-select por design).
- Nenhuma mudan\u00e7a em hooks de dados (`useTeamPerformance`, `useEquipeData`) nem na assinatura consumida pelo `EquipePerformanceTab`.
- Sem altera\u00e7\u00f5es nos di\u00e1logs `UserCallsDialog` / `UserConversationsDialog` / `UserOutcomesDialog` (este filtro vive s\u00f3 na aba).

## Arquivos

- `src/pages/equipe/components/EquipePerformanceTab.tsx` (apenas o sub-componente `UserMultiSelect`).