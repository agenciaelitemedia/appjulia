

# Nova Aba: Fila de Notificação

## Resumo

Criar uma aba "Fila" no módulo de Notificações de Contrato que mostra os envios programados para as próximas 24 horas. A lógica replica o cálculo do cron: para cada contrato ativo, verifica a última etapa enviada, calcula quando o próximo envio ocorrerá, e lista apenas os que estão previstos nas próximas 24h. Separados em duas seções: Followup de Leads e Notificações do Escritório.

## Como funciona

A fila não existe como dados no banco — é calculada em tempo real via uma Edge Function que:
1. Busca configs ativas do agente
2. Consulta contratos na base externa (mesma query do cron)
3. Para cada contrato, consulta o último log de envio
4. Calcula `próximo envio = último envio + intervalo da próxima etapa`
5. Retorna apenas os que têm `próximo envio` dentro das próximas 24h (ou envios imediatos pendentes)

## Arquivos

### 1. Criar Edge Function `supabase/functions/contract-notifications-queue/index.ts`

- Recebe `cod_agent` no body
- Reutiliza a mesma lógica de conexão externa e query de contratos do cron
- Para cada config ativa (LEAD_FOLLOWUP e OFFICE_ALERT), calcula os envios pendentes
- Retorna array com: `type`, `contract_cod_document`, `client_name`, `case_title`, `recipient_phone`, `step_number`, `step_title`, `estimated_at` (timestamp estimado do envio), `message_preview` (primeiros 100 chars)

### 2. Criar `src/pages/contract-notifications/components/NotificationQueueTab.tsx`

- Chama a Edge Function ao montar
- Exibe duas seções com cards/tabelas:
  - **Followup de Leads** — lista de envios programados tipo LEAD_FOLLOWUP
  - **Notificações do Escritório** — lista de envios tipo OFFICE_ALERT
- Cada item mostra: contrato, cliente, destinatário, etapa, título da etapa, horário estimado, preview da mensagem
- Botão de refresh
- Estado vazio por seção

### 3. Editar `ContractNotificationsPage.tsx`

- Adicionar TabsTrigger "Fila" e TabsContent com `NotificationQueueTab`

### 4. Hook (opcional, inline)

- Pode ser um `useQuery` inline no componente chamando `supabase.functions.invoke('contract-notifications-queue', { body: { cod_agent } })`

## Sem migration necessária

Dados são calculados em tempo real a partir das tabelas e base externa existentes.

