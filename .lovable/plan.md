

# Refatorar Notificações de Contrato: Etapas Individuais

## Resumo

Atualmente o módulo usa uma configuração global (um template, um intervalo, N etapas). A mudanca faz cada etapa ter seu proprio intervalo e mensagem, seguindo o padrao do `FollowupConfig` + `CadenceStepEditor` do modulo de followup.

## 1. Banco de dados — Alterar `contract_notification_configs`

Adicionar 3 colunas JSONB para armazenar cadencia por etapa (mesmo padrao do followup):

```sql
ALTER TABLE contract_notification_configs
  ADD COLUMN IF NOT EXISTS step_cadence jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS msg_cadence jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title_cadence jsonb DEFAULT '{}';
```

Formato dos dados:
- `step_cadence`: `{"cadence_1": "1440 minutes", "cadence_2": "2880 minutes", ...}`
- `msg_cadence`: `{"cadence_1": "Olá {client_name}...", "cadence_2": "Lembrete...", ...}`
- `title_cadence`: `{"cadence_1": "Primeiro lembrete", "cadence_2": "Segundo lembrete", ...}`

As colunas antigas (`stages_count`, `delay_interval_minutes`, `message_template`) permanecem para compatibilidade mas nao serao mais usadas no frontend.

## 2. Frontend — LeadFollowupTab

Reescrever para usar o padrao de etapas do FollowupConfig:
- Switch ativar/desativar (mantem)
- Remover inputs globais de "quantidade de etapas" e "intervalo"
- Remover textarea global de template
- Adicionar lista de etapas com botao "Adicionar Etapa"
- Cada etapa usa um card com: titulo, intervalo (valor + unidade: minutos/horas/dias), e textarea de mensagem
- Reutilizar o componente `CadenceStepEditor` existente (ou criar versao local simplificada sem "auto message")
- Manter a nota do link ZapSign automatico
- Salvar como `step_cadence`, `msg_cadence`, `title_cadence` + `stages_count` (derivado do total de etapas)

## 3. Frontend — OfficeNotificationTab

Aplicar o mesmo padrao de etapas:
- Manter: switch on/off, radio trigger event, input de numeros WhatsApp (chips)
- Substituir: textarea global de template e input de "repeticoes" por lista de etapas
- Cada etapa tem: titulo, intervalo, e textarea de mensagem (com variaveis `{client_name}`, `{client_phone}`, `{case_title}`, `{case_summary}`, `{trigger_label}`)
- Manter a nota de "Dados Automaticos"
- Salvar como `step_cadence`, `msg_cadence`, `title_cadence` + `stages_count`

## 4. Hook e Edge Function

- `useContractNotificationConfig.ts`: Atualizar interface `ContractNotificationConfig` com os 3 novos campos JSONB
- `contract-notifications-cron/index.ts`: Atualizar logica para ler `step_cadence` e `msg_cadence` por etapa em vez de usar `message_template` e `delay_interval_minutes` globais. Para cada contrato, buscar a etapa atual (step_number do log) e usar o intervalo e mensagem correspondentes de `step_cadence[cadence_N]` e `msg_cadence[cadence_N]`

## 5. Componente compartilhado

Criar `ContractCadenceStepEditor.tsx` em `src/pages/contract-notifications/components/` — versao simplificada do `CadenceStepEditor` sem toggle de "auto message" (sempre mensagem manual). Reutiliza types `CadenceStep`, `INTERVAL_UNITS`, `parseInterval`, `formatInterval` de `src/pages/agente/types.ts`.

## Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar `step_cadence`, `msg_cadence`, `title_cadence` |
| `src/hooks/useContractNotificationConfig.ts` | Adicionar campos JSONB a interface |
| `src/pages/contract-notifications/components/ContractCadenceStepEditor.tsx` | Novo — editor de etapa |
| `src/pages/contract-notifications/components/LeadFollowupTab.tsx` | Reescrever com etapas individuais |
| `src/pages/contract-notifications/components/OfficeNotificationTab.tsx` | Reescrever com etapas individuais |
| `supabase/functions/contract-notifications-cron/index.ts` | Atualizar logica para cadencia por etapa |

