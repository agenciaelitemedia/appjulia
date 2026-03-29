

# Módulo: Notificações de Contrato

## Visao geral

Novo modulo com duas abas de configuracao por `cod_agent`:
- **Aba 1 - Followup de Leads**: regua automatica de cobranca para contratos gerados e nao assinados (envia WhatsApp com link do contrato)
- **Aba 2 - Notificar Escritorio**: alertas para numeros do escritorio quando contrato e gerado ou assinado, incluindo dados do lead e resumo do caso

Motor: Edge Function + pg_cron que roda periodicamente, consulta configs ativas e dispara via N8N_HUB_SEND_URL.

## 1. Banco de dados (Supabase — 2 tabelas)

### Tabela `contract_notification_configs`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| cod_agent | text NOT NULL | index |
| type | text NOT NULL | 'LEAD_FOLLOWUP' ou 'OFFICE_ALERT' |
| is_active | boolean | default false |
| stages_count | integer | max etapas (followup) |
| delay_interval_minutes | integer | tempo entre envios |
| message_template | text | template da mensagem |
| target_numbers | text[] | telefones do escritorio |
| trigger_event | text | 'GENERATED', 'SIGNED', 'BOTH' |
| office_repeat_count | integer | alertas repetitivos se nao assinou |
| created_at / updated_at | timestamptz | defaults now() |

RLS: Allow all (padrao do projeto).

### Tabela `contract_notification_logs`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| config_id | uuid | ref config |
| cod_agent | text | |
| contract_cod_document | text | identificador do contrato |
| type | text | LEAD_FOLLOWUP ou OFFICE_ALERT |
| step_number | integer | etapa atual |
| recipient_phone | text | |
| message_text | text | mensagem enviada |
| status | text | pending/sent/failed |
| sent_at | timestamptz | |
| error_message | text | |
| created_at | timestamptz | default now() |

RLS: Allow all.

## 2. Edge Function: `contract-notifications-cron`

Logica:
1. Busca configs ativas do tipo LEAD_FOLLOWUP
2. Consulta contratos com `status_document = 'Gerado'` (base externa via externalDb pattern — usa Pool postgres igual advbox-notify)
3. Cruza com logs para determinar ultima etapa enviada e tempo decorrido
4. Se `(now - ultimo_envio) >= delay_interval_minutes` e `step < stages_count`, renderiza template substituindo variaveis e apenda link do contrato ZapSign
5. Envia via N8N_HUB_SEND_URL e registra log

Para OFFICE_ALERT:
1. Busca configs ativas do tipo OFFICE_ALERT
2. Identifica contratos recentes com evento matching (gerado/assinado)
3. Busca `resumo_do_caso` do contrato (campo ja existente na base externa)
4. Envia para cada numero em `target_numbers` com dados do lead injetados
5. Registra log

Cron via pg_cron: a cada 5 minutos chama a Edge Function.

## 3. Frontend

### Arquivos novos

| Arquivo | Descricao |
|---|---|
| `src/pages/contract-notifications/ContractNotificationsPage.tsx` | Pagina principal com seletor de agente + Tabs |
| `src/pages/contract-notifications/components/LeadFollowupTab.tsx` | Form: on/off, qtd etapas, intervalo, template da mensagem, nota sobre link automatico |
| `src/pages/contract-notifications/components/OfficeNotificationTab.tsx` | Form: on/off, trigger (gerado/assinado/ambos), numeros WhatsApp (chips), repeticoes, template, nota sobre dados do lead automaticos |
| `src/hooks/useEnsureContractNotificationsModule.ts` | Registra modulo no menu (code: `contract_notifications`, grupo: SISTEMA, icon: Bell, rota: `/notificacoes-contrato`) |
| `src/hooks/useContractNotificationConfig.ts` | Hook CRUD com react-query para configs Supabase |

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/types/permissions.ts` | Adicionar `'contract_notifications'` ao ModuleCode |
| `src/App.tsx` | Rota `/notificacoes-contrato` |
| `src/components/layout/Sidebar.tsx` | Chamar useEnsureContractNotificationsModule() |

### UI da Aba Followup
- Switch ativar/desativar
- Input numerico: quantidade de etapas (1-10)
- Input numerico: intervalo em minutos entre envios
- Textarea: template da mensagem com variaveis `{client_name}`, `{case_title}`
- Nota fixa: "O link do contrato sera inserido automaticamente no final de cada mensagem."

### UI da Aba Escritorio
- Switch ativar/desativar
- Radio/Checkbox: "Ao Gerar Contrato" / "Ao Assinar Contrato" / Ambos
- Input de chips para numeros WhatsApp do escritorio
- Input numerico: quantidade de alertas repetitivos (se contrato gerado e nao assinado)
- Textarea: template do alerta
- Nota fixa: "Nome do Lead, telefone e Resumo do Caso serao injetados automaticamente."

## 4. Ordem de execucao

1. Criar tabelas via migration
2. Criar Edge Function `contract-notifications-cron`
3. Configurar pg_cron para chamar a funcao a cada 5 min
4. Criar pagina frontend e hooks
5. Registrar modulo e rota
6. Deploy da Edge Function

