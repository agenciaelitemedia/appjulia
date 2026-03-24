

# Criar Pagina de Monitoramento do Webhook WABA

## Resumo

Nova pagina `/admin/webhook-monitor` com visualizacao em tempo real dos logs do webhook Meta, usando polling automatico na edge function `meta-webhook` (action `get_logs`).

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/admin/webhook-monitor/WebhookMonitorPage.tsx` | Criar -- pagina principal com tabela de logs, auto-refresh (polling 10s), filtros por agente/status, badge de forwarded/not forwarded |
| `src/App.tsx` | Adicionar import e rota `/admin/webhook-monitor` |
| `supabase/functions/meta-webhook/index.ts` | Aumentar buffer de logs de 100 para 200 e adicionar campo `cod_agent` e `forwarded` no retorno de `get_logs` (ja existem nos logs, apenas garantir que retornam) |

## Funcionalidades da pagina

- **Header** com titulo, badge de status (polling ativo/pausado), botao play/pause
- **Tabela** com colunas: Timestamp, De (from), Mensagem, Agente (cod_agent), Status (forwarded sim/nao), Tipo (message/status)
- **Auto-refresh** via polling a cada 10 segundos (toggleavel)
- **Contador** de mensagens recebidas
- **Filtro** por texto (busca em from/message)
- Usa componentes existentes: Table, Badge, Card, ScrollArea, Input
- Chama `supabase.functions.invoke('meta-webhook', { body: { action: 'get_logs' } })` para buscar logs

## Layout

Card unico com a tabela ocupando a area principal. Badge verde pulsante quando polling ativo. Rows coloridas: verde para forwarded, amarelo para nao forwarded (sem agente).

