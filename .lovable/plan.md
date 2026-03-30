

# Adicionar Seletor de Agente na Página de Notificações de Contrato

## Resumo

Replicar o padrão do FollowUp: adicionar o componente `AgentSearchSelect` no header da página, usando `useJuliaAgents()` para listar os agentes disponíveis. O `codAgent` passa a ser controlado pelo seletor em vez de vir fixo do `user.cod_agent`.

## Alterações

### `ContractNotificationsPage.tsx`

1. Importar `AgentSearchSelect`, `useJuliaAgents`, `Label`, `RefreshCw`, `Button`, e helpers de persistência (`getSavedAgentCodes`, `saveAgentCodes`)
2. Substituir `const codAgent = user?.cod_agent` por estado local `selectedAgent` controlado pelo seletor
3. Adicionar `useEffect` para selecionar o primeiro agente ao carregar (ou restaurar o salvo), idêntico ao FollowUp
4. Adicionar `useEffect` para persistir a seleção via `saveAgentCodes`
5. Reorganizar o header para layout flex com título à esquerda e seletor de agente + botão refresh à direita (mesmo padrão visual do screenshot)
6. Remover o guard `if (!codAgent)` que mostrava "Nenhum agente selecionado" — agora o seletor sempre aparece
7. Todos os componentes filhos (`LeadFollowupTab`, `OfficeNotificationTab`, `NotificationQueueTab`, `NotificationLogsTab`) já recebem `codAgent` como prop, então funcionam automaticamente com o agente selecionado

## Arquivo afetado

| Arquivo | Ação |
|---|---|
| `src/pages/contract-notifications/ContractNotificationsPage.tsx` | Refatorar para usar seletor de agente |

Nenhuma migration ou edge function necessária.

