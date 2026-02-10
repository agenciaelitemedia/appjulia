
# Plano: Configurar pg_cron com Verificacao a Cada 7 Dias por Processo

## Contexto

A cron roda a cada 6 horas, mas cada processo individual so deve ser verificado a cada 7 dias a partir da sua data de inclusao (ou ultima verificacao). Isso evita chamadas desnecessarias a API do DataJud.

## Alteracoes

### 1. Edge Function `datajud-monitor/index.ts`

Adicionar filtro na query do Supabase para buscar apenas processos que estejam "prontos" para verificacao:

- Se `last_check_at` e NULL (nunca verificado), verificar imediatamente
- Se `last_check_at` tem valor, so verificar se ja passaram 7 dias

A query atual:
```sql
SELECT * FROM datajud_monitored_processes WHERE status = 'active'
```

Passa a ser:
```sql
SELECT * FROM datajud_monitored_processes
WHERE status = 'active'
AND (last_check_at IS NULL OR last_check_at <= now() - interval '7 days')
```

Isso e implementado no Supabase client usando `.or('last_check_at.is.null,last_check_at.lte.' + sevenDaysAgo)`.

### 2. Migracao SQL

Habilitar as extensoes `pg_cron` e `pg_net`, e criar o cron job:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'datajud-monitor-check',
  '0 */6 * * *',
  $$ SELECT net.http_post(
    url := 'https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/datajud-monitor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id; $$
);
```

### 3. Resumo dos Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/datajud-monitor/index.ts` | Filtrar processos por `last_check_at <= now() - 7 days` |
| Migracao SQL (via ferramenta) | Habilitar pg_cron, pg_net e agendar o job |

### Detalhes Tecnicos

**Logica de filtragem na Edge Function:**

```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const { data: processes } = await supabase
  .from("datajud_monitored_processes")
  .select("*")
  .eq("status", "active")
  .or(`last_check_at.is.null,last_check_at.lte.${sevenDaysAgo}`);
```

- Processos recem-adicionados (`last_check_at = NULL`) sao verificados na proxima execucao da cron (maximo 6h apos inclusao)
- Apos a primeira verificacao, so serao verificados novamente 7 dias depois
- A cron roda a cada 6h, entao na pratica o intervalo real sera entre 7 e 7.25 dias

**Cron schedule:** `0 */6 * * *` = a cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)
