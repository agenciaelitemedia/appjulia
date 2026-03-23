

# Implementar Suporte a API Oficial Meta (WABA) nos Agentes

## Status: ✅ Implementado

### O que foi feito

1. **Edge Function `waba-admin`** — exchange_token, save_credentials, verify_connection, disconnect
2. **Edge Function `db-query`** — 3 novos cases WABA + campos waba_id/waba_number_id/waba_configured no get_user_agents
3. **Frontend** — ProviderSelector, WabaSetupDialog, ConnectionStatusBadge (API Oficial badge), ConnectionControlButtons (suporte WABA), AgentCard (info por provider), useConnectionStatus (branch WABA)
4. **Tipos** — WhatsAppProvider type, campos WABA no UserAgent, status waba_connected

### ⚠️ SQL pendente no banco externo

Executar manualmente no banco externo:

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_token TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_number_id VARCHAR(50) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_waba_id ON agents(waba_id) WHERE waba_id IS NOT NULL;
```
