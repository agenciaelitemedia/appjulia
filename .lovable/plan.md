

# Webhook Vellip — tabela + edge function

## 1. Migração: tabela `vellip_call_logs`

```sql
CREATE TABLE vellip_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text,
  phone text,
  cd_id text,
  cd_date text,
  cd_time text,
  cd_time_start text,
  cd_time_end text,
  cd_time_sec integer,
  cd_time_sec2 integer,
  cd_price text,
  cd_value text,
  cd_name text,
  cd_route text,
  cd_called_status text,
  cd_resp1 text,
  saldo text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vellip_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on vellip_call_logs" ON vellip_call_logs FOR ALL USING (true) WITH CHECK (true);
```

## 2. Edge Function: `supabase/functions/vellip-webhook/index.ts`

- Recebe POST com JSON da Vellip
- Lê `cod_agent` do query param (`?cod_agent=XXX`), se ausente grava `null`
- Extrai do body: `dest` → `phone`, e os campos `cd_id`, `cd_date`, `cd_time`, `cd_time_start`, `cd_time_end`, `cd_time_sec`, `cd_time_sec2`, `cd_price`, `cd_value`, `cd_name`, `cd_route`, `cd_called_status`, `cd_resp1`, `saldo`
- Se `dest` ou `cd_id` não existirem no JSON, retorna 200 sem gravar
- Grava o JSON inteiro em `raw_payload`
- CORS headers + OPTIONS handler
- `verify_jwt = false` no config.toml

## 3. `supabase/config.toml`

Adicionar bloco:
```toml
[functions.vellip-webhook]
verify_jwt = false
```

## Resultado

URL para configurar na Vellip:
```
https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/vellip-webhook?cod_agent=SEU_COD_AGENT
```

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `vellip_call_logs` |
| `supabase/functions/vellip-webhook/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar bloco vellip-webhook |

