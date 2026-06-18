## Objetivo

No drawer de performance do usuário em `/equipe` → Performance:
1. Espelhar o padrão do card **Tempo online** (botão de ícone com tooltip que abre dialog de detalhes) nos cards **Atendimentos** e **Ligações**.
2. Remover o card **Top 20 números chamados**.

## Mudanças

### `src/pages/equipe/components/EquipePerformanceDrawer.tsx`
- Remover o `<Card>` inteiro de "Top 20 números chamados" (linhas 161-200) e o hook `useUserTopNumbers` + imports relacionados (`Table*`, `Badge`, `ListOrdered`/`Loader2` se não usados mais em outros pontos do drawer).
- No `MiniKpi` de **Atendimentos**, adicionar `action` com um `Button ghost icon` (ícone `ListOrdered`) + tooltip "Ver atendimentos do período", abrindo `<UserConversationsDialog>`.
- No `MiniKpi` de **Ligações**, adicionar `action` análoga abrindo `<UserCallsDialog>`.
- Estados locais: `const [convOpen, setConvOpen] = useState(false)` e `const [callsOpen, setCallsOpen] = useState(false)`.

### Novo: `src/pages/equipe/components/UserConversationsDialog.tsx`
Estrutura idêntica ao `UserSessionsDialog` (header com período, summary boxes, tabela rolável, export CSV).
- Hook novo `useUserConversations(userId, period)` em `useTeamPerformance.ts`:
  - Consulta `chat_conversations` filtrando `client_id`, `assigned_to = <nome do usuário>` (mesmo padrão do `useTeamDashboardMetrics`) e `created_at`/`updated_at` no range BRT.
  - Retorna: `contact_name`, `phone`, `status`, `created_at`, `updated_at`, `last_message_at`, `tag` (resolvida/devolvida/transferida via histórico se disponível, senão pelo status).
- Summary boxes: Total · Resolvidas · Devolvidas · Transferidas.
- Colunas da tabela: Contato · Início · Última msg · Status (badge).

### Novo: `src/pages/equipe/components/UserCallsDialog.tsx`
Estrutura idêntica.
- Hook novo `useUserCalls(userId, period)`:
  - Consulta `phone_call_logs` filtrando `client_id`, `user_id`, `started_at` no range BRT, ordenado desc, limite 500.
  - Retorna: `phone_display`, `direction` (in/out), `answered` (bool), `started_at`, `talk_seconds`.
- Summary boxes: Total · Atendidas · Talk time total · Números únicos.
- Colunas: Número · Direção (badge in/out) · Início · Status · Duração.

### `src/pages/equipe/hooks/useTeamPerformance.ts`
- Adicionar `useUserConversations` e `useUserCalls` (`useQuery` + Supabase client).
- Remover `useUserTopNumbers` (não é mais usado em lugar nenhum).

## Detalhes técnicos

- Reaproveitar `MiniKpi` (já aceita `action`) e o helper `fmtDuration` / `fmtDateTime`.
- Export CSV em ambos os diálogos seguindo o mesmo padrão do `UserSessionsDialog` (`;` separator, mesmo nome de arquivo).
- Sem mudanças de schema/SQL — todos os dados já estão acessíveis via tabelas existentes (`chat_conversations`, `phone_call_logs`) com as policies vigentes.
- Sem mudanças de rota; o domínio `acesso.atendejulia.com.br` continua sem ver a aba Performance (regra já existente).
