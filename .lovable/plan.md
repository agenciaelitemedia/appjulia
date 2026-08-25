# Corrigir alertas de "Contrato em curso" e "Contrato assinado"

## O que foi verificado

Consultei as configurações, os logs, os cards do CRM de Notificações e a tabela de contratos do banco legado.

- As duas configurações do agente 202603001 (destino (34) 98886-0163) estão **ativas** e com destinatário — não é problema de configuração.
- Logs de disparo existentes: `contract_in_progress` = 2 envios (últimos em 22/08), `contract_signed` = 1 envio (22/08).
- Cards no CRM de Notificações com gatilho de contrato: **apenas 1** (`contract_signed`, 22/08). Os 2 cards de "Contrato em curso" que existiram desapareceram.
- Contratos do agente 202603001 nos últimos 7 dias: 3 `CREATED` (último 22/08 16:52) e 2 `SIGNED` (assinado 22/08 09:06).

## Causas confirmadas

1. **Janela de 10 minutos sobre `created_at`.** Os gatilhos de contrato só consideram contratos **criados** nos últimos 10 minutos. Contrato criado ontem/anteontem nunca entra — por isso não há nenhum card "Contrato em curso" agora.
2. **"Contrato assinado" filtra pela data de criação, não pela data da assinatura.** A consulta usa `status = 'SIGNED' AND created_at >= janela`. Um contrato criado dia 19 e assinado dia 24 nunca cai na janela. O único card existente é justamente o caso em que criação e assinatura ocorreram no mesmo minuto. A tabela tem a coluna `signed_at`, hoje ignorada.
3. **Um card por lead por agente sobrescreve o gatilho anterior.** O card do CRM é único por (agente, telefone). Quando o mesmo lead depois entra em "parou de responder"/"qualificado", o card é **reaproveitado** e o `trigger_key` é trocado — o card de "Contrato em curso" deixa de existir. Isso explica 2 disparos registrados e 0 cards.

## Correções

### 1. Assinatura passa a usar `signed_at`
Na consulta legada de `contract_signed`, trocar o piso de recência para `COALESCE(signed_at, created_at) >= janela` e usar `signed_at` no marcador/dedupe. Assim todo contrato assinado gera alerta no momento da assinatura, independentemente de quando foi criado.

### 2. "Em curso" com janela de elegibilidade coerente
Para `contract_in_progress`, considerar contratos com status `CREATED`/`PENDING`, ainda sem `signed_at`, usando `GREATEST(created_at, updated_at)` como âncora — mantendo a janela para não reenviar sempre, mas com dedupe por `cod_document` (já existe), que garante 1 alerta por contrato para sempre.

### 3. Cards de contrato não são mais sobrescritos
No upsert do card: quando o card existente é de gatilho de contrato (`contract_in_progress`/`contract_signed`) e o novo gatilho **não** é de contrato, aplicar a mesma regra já usada em "parou de responder": não move o card, só atualiza data e etiqueta. E quando o novo gatilho é `contract_signed` sobre um card `contract_in_progress`, mover normalmente (progressão natural).

### 4. Backfill dos últimos 7 dias
Rodar o cron uma vez com janela ampliada (`window_minutes: 10080`) para criar os cards de contratos em curso e assinados dos últimos 7 dias. A função já aceita esse parâmetro, mas hoje limita a 1440 min — elevar o teto para 10080 para permitir o backfill.

Observação: o backfill dispara também as mensagens no WhatsApp dos destinatários. Se preferir, incluo um modo `dry_card_only: true` que cria os cards sem enviar mensagem.

## Detalhes técnicos

Arquivo único: `supabase/functions/alert-notifications-cron/index.ts`
- `fetchCandidates` (bloco de contratos): separar as duas consultas, usar `signed_at` para assinado e `status IN ('CREATED','PENDING')` + `signed_at IS NULL` para em curso; âncora via `floorSql`.
- `fetchXJContractCandidates`: manter, já usa `signed_at` para o gatilho de assinado.
- `upsertAlertCrmCard`: adicionar proteção de gatilhos de contrato contra sobrescrita por gatilhos não-contratuais.
- `serve`: teto de `window_minutes` de 1440 → 10080; opcional `card_only`.
