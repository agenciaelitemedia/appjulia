

# Aba de Histórico de Envios — Notificações de Contrato

## Resumo

Adicionar uma terceira aba "Histórico" no módulo de Notificações de Contrato que exibe os logs de envios já registrados na tabela `contract_notification_logs`. O hook `useContractNotificationLogs` já existe.

## Arquivos

### 1. Criar `src/pages/contract-notifications/components/NotificationLogsTab.tsx`

Componente que:
- Usa `useContractNotificationLogs(codAgent)` para buscar os logs
- Exibe uma tabela com colunas: Data/Hora, Tipo (badge LEAD_FOLLOWUP / OFFICE_ALERT), Contrato, Destinatário, Etapa, Status (badge sent/failed/pending), e Erro (se houver)
- Formatação de data com `format` do date-fns
- Badge colorido para status: verde (sent), vermelho (failed), amarelo (pending)
- Badge para tipo: azul (LEAD_FOLLOWUP), roxo (OFFICE_ALERT)
- Estado vazio com mensagem "Nenhum envio registrado"
- Botão de refresh para recarregar os logs

### 2. Editar `ContractNotificationsPage.tsx`

- Importar `NotificationLogsTab`
- Adicionar terceiro `TabsTrigger` "Histórico" e `TabsContent` correspondente

## Sem alteração de banco

A tabela `contract_notification_logs` e o hook `useContractNotificationLogs` já existem. Nenhuma migration necessária.

