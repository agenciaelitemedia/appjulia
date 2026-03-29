

# Trigger Event por Número WhatsApp

## Resumo

Atualmente o "Disparar Quando" (Gerado/Assinado/Ambos) é uma configuração global. A mudança faz cada número WhatsApp cadastrado ter seu próprio trigger event individual.

## Mudança de dados

O campo `target_numbers` (text[]) armazena apenas telefones. Será substituído por um campo JSONB `target_numbers_config` que armazena objetos com número e trigger:

```json
[
  { "phone": "11999998888", "trigger": "GENERATED" },
  { "phone": "11888887777", "trigger": "BOTH" }
]
```

O campo `trigger_event` global permanece como fallback mas não será mais usado no frontend.

## Migration

```sql
ALTER TABLE contract_notification_configs
  ADD COLUMN IF NOT EXISTS target_numbers_config jsonb DEFAULT '[]'::jsonb;
```

Migrar dados existentes: converter cada item de `target_numbers[]` para `{"phone": X, "trigger": trigger_event}`.

## Frontend — OfficeNotificationTab

- Remover o RadioGroup global de "Disparar Quando"
- Ao adicionar número, incluir um Select ao lado para escolher o trigger (Ao Gerar / Ao Assinar / Ambos) — default "BOTH"
- Nos chips de números exibidos, mostrar o trigger como badge menor (ex: "11999998888 · Ambos")
- Estado interno muda de `string[]` para `Array<{phone: string, trigger: string}>`
- No save, salvar em `target_numbers_config` (JSONB) e manter `target_numbers` (text[]) sincronizado para compatibilidade

## Edge Function — contract-notifications-cron

Na seção OFFICE_ALERT:
- Ler `target_numbers_config` (JSONB) em vez de `target_numbers`
- Para cada número, filtrar contratos pelo trigger individual daquele número (GENERATED/SIGNED/BOTH) em vez de usar o filtro global
- Fallback: se `target_numbers_config` estiver vazio, usar `target_numbers` + `trigger_event` global (compatibilidade)

## Hook

- Adicionar `target_numbers_config` à interface `ContractNotificationConfig`

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar coluna `target_numbers_config` |
| `src/hooks/useContractNotificationConfig.ts` | Adicionar campo à interface |
| `src/pages/contract-notifications/components/OfficeNotificationTab.tsx` | Refatorar para trigger por número |
| `supabase/functions/contract-notifications-cron/index.ts` | Filtrar por trigger individual |

