## Objetivo
No `EquipePerformanceDrawer`, adicionar um ícone de detalhes no card **Tempo logado** que abre um modal listando todas as sessões (login → logout) do usuário no período selecionado, com duração de cada uma.

## Mudanças

### 1. Hook novo — `useUserSessions(userId, period)`
Arquivo: `src/pages/equipe/hooks/useTeamPerformance.ts` (adicionar export).

- Lê `user_activity_log` filtrando por `user_id` e `created_at` dentro do período (BRT).
- Ordena por `created_at` ASC.
- Pareia cada `login` com o próximo `logout_manual` ou `logout_inactivity` do mesmo usuário, montando linhas:
  ```ts
  { login_at: string; logout_at: string | null; logout_type: string | null; duration_seconds: number | null }
  ```
- Regras de borda:
  - Login sem logout no período → `logout_at = null`, duration = `now - login_at` se for o dia corrente; caso contrário `null` (sessão em aberto/desconhecida).
  - Logout sem login pareado → ignora (orfão), mas conta no resumo como "logout sem login".
  - Aplica o teto de 12h por sessão (mesma regra da MV) ao calcular `duration_seconds`.

### 2. Componente novo — `UserSessionsDialog`
Arquivo: `src/pages/equipe/components/UserSessionsDialog.tsx`.

- `Dialog` do shadcn (não Sheet, para abrir sobre o drawer existente).
- Header: nome do usuário + período.
- Resumo no topo: total de sessões, tempo total logado (soma já formatada), média por sessão.
- Tabela com colunas:
  | Login | Logout | Tempo online |
  Cada linha formatada como `17/06/2026 08:02 | 17/06/2026 10:15 | 1:59`.
  - `logout_type` exibido como badge sutil ao lado do logout (`Manual` / `Inatividade` / `Em aberto`).
  - Estado vazio: "Nenhum login registrado no período".
  - Loading: spinner.
- Botão "Exportar CSV" no canto (mesma estética dos outros export do módulo).

### 3. Ajuste no `EquipePerformanceDrawer`
- Importar `Info` (lucide) e o novo `UserSessionsDialog`.
- Estender `MiniKpi` para aceitar prop opcional `action?: ReactNode` renderizada no canto superior direito (botão `ghost` `size="icon"` h-6 w-6).
- No card "Tempo logado", passar um botão com ícone `Info` (ou `List`) que faz `setSessionsOpen(true)`.
- Renderizar `<UserSessionsDialog open={...} user={user} period={period} />` no final do Sheet.

## Detalhes técnicos
- Formatação de duração no formato `H:MM` (ex.: `1:59`, `0:45`) — helper local no dialog, separado do `fmtDuration` existente que usa `h`/`m`.
- Datas exibidas em `dd/MM/yyyy HH:mm` via `date-fns` + `ptBR` (já importado no drawer).
- Query key: `['user-sessions', userId, period.startDate, period.endDate]`, `staleTime: 60_000`.
- Permissões: módulo `team` já protege a rota — sem mudanças.

## Arquivos
- editar: `src/pages/equipe/hooks/useTeamPerformance.ts`
- criar:  `src/pages/equipe/components/UserSessionsDialog.tsx`
- editar: `src/pages/equipe/components/EquipePerformanceDrawer.tsx`
