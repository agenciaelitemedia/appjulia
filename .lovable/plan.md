# Corrigir horários em fusos diferentes nos cards do CRM

## O que está acontecendo (confirmado nos dados)

As colunas `created_at`, `updated_at` e `stage_entered_at` de `crm_atendimento_cards` são `timestamp without time zone` (sem fuso). Existem **dois padrões de gravação convivendo** na mesma coluna:

- **Sistema legado (n8n/JulIA)**: grava a hora de **Brasília** direto, sem offset.
- **Este app**: grava `new Date().toISOString()`, ou seja **UTC** (3h à frente).

Exemplo real do card que você selecionou (id 58532): `created_at = 11:24` (Brasília) e `updated_at/stage_entered_at = 14:11` (UTC). Hoje há **32 cards com `updated_at` no futuro** em relação à hora de Brasília — a prova de que foram gravados em UTC.

Na leitura, `formatDbTimestamp`/`parseDbTimestamp` (em `src/lib/dateUtils.ts`) removem o `Z` e exibem o valor cru, assumindo que tudo é Brasília. Resultado: as datas gravadas pelo app aparecem 3h adiantadas, no mesmo card, ao lado de datas corretas.

Efeito colateral: as regras de janela de 10 minutos de **Notificações e Alertas** usam `stage_entered_at`, então cards gravados em UTC também entram/saem da janela na hora errada.

## Correção proposta

Padronizar tudo em **hora de Brasília** (o padrão da maioria dos 62 mil registros), em três frentes:

1. **Padronizar a gravação (app)**
   - Novo helper em `src/lib/dateUtils.ts`: `nowDbTimestamp()` retornando `YYYY-MM-DD HH:mm:ss` no fuso `America/Sao_Paulo`.
   - Substituir `new Date().toISOString()` por `nowDbTimestamp()` em todas as escritas no banco externo:
     - `src/pages/crm/hooks/useCRMData.ts` (mover card, atualizar card, notas, histórico `changed_at`)
     - `src/components/chat/ChatLinkedDealSheet.tsx` (vínculo/movimentação de card)
     - `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

2. **Padronizar a gravação (backend)**
   - Nas actions de update do `db-query` que já usam `now()`, trocar por `(now() AT TIME ZONE 'America/Sao_Paulo')`, para o banco externo (sessão em UTC) gravar Brasília.

3. **Backfill dos registros já gravados errados**
   - Corrigir (`- interval '3 hours'`) apenas os registros comprovadamente em UTC — aqueles com `updated_at`/`stage_entered_at` **no futuro** em relação à hora atual de Brasília, em `crm_atendimento_cards` e `crm_atendimento_history` (`changed_at`).
   - Registros antigos gravados em UTC há mais de 3h não são distinguíveis com certeza dos legados, então não serão alterados às cegas.

4. **Proteção na exibição**
   - Em `parseDbTimestamp`, se o timestamp estiver no futuro por mais de ~2h em relação a agora (Brasília), tratar como UTC e subtrair 3h. Isso evita que qualquer escrita residual em UTC volte a aparecer adiantada, sem afetar os registros corretos.

## Detalhes técnicos

- Nada muda no tipo das colunas (segue `timestamp without time zone`) — só o valor gravado e a leitura defensiva.
- Backfill via SQL no banco externo, restrito à condição de "futuro", executado uma vez e conferido antes/depois com contagem.
- `alert-notifications-cron` não precisa de mudança de lógica: com os dados padronizados, a janela de 10 minutos passa a bater.
