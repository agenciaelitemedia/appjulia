

# Próximo Passo: Fase 5 - Edge Functions + Páginas Pendentes

## Visão Geral

Esta fase implementa as funcionalidades restantes do módulo Advbox:
1. **Edge Function `advbox-notify`** - Envio de notificações via WhatsApp
2. **Edge Function `advbox-query`** - Consultas de processos via Julia IA
3. **Páginas `LogsPage` e `QueriesPage`** - Histórico de notificações e consultas
4. **Hooks `useNotificationLogs` e `useClientQueries`**
5. **Configuração de Secrets** - `ADVBOX_ENCRYPTION_KEY` e `N8N_HUB_SEND_URL`

---

## Parte 1: Edge Function `advbox-notify`

### Arquivo: `supabase/functions/advbox-notify/index.ts`

**Responsabilidades:**
- Enviar notificação de movimentação processual via WhatsApp (através do n8n Hub)
- Renderizar template substituindo variáveis (`{client_name}`, `{process_number}`, etc.)
- Registrar log de envio na tabela `advbox_notification_logs`
- Suportar reenvio de notificações que falharam

**Endpoint:**
```
POST /advbox-notify
{
  "agent_id": 123,
  "rule_id": "uuid",
  "process_id": "abc",
  "recipient_phone": "5534988860163",
  "variables": {
    "client_name": "João Silva",
    "process_number": "0001234-56.2024.8.13.0000",
    "movement_text": "Sentença proferida",
    "movement_date": "2024-01-15",
    "phase": "Judicial",
    "responsible": "Dr. Carlos"
  }
}
```

---

## Parte 2: Edge Function `advbox-query`

### Arquivo: `supabase/functions/advbox-query/index.ts`

**Responsabilidades:**
- Buscar processos do cliente pelo telefone no cache local
- Chamado pelo n8n/Julia IA como ferramenta (tool)
- Retornar dados formatados para resposta via WhatsApp
- Registrar log de consulta na tabela `advbox_client_queries`

**Endpoint:**
```
POST /advbox-query
{
  "agent_id": 123,
  "client_phone": "5534988860163",
  "query_type": "status_processo",
  "query_text": "Qual o status do meu processo?"
}
```

**Resposta:**
```json
{
  "success": true,
  "found_processes": 2,
  "processes": [
    {
      "process_number": "0001234-56.2024.8.13.0000",
      "phase": "Judicial",
      "status": "Em andamento",
      "last_movement": "Sentença proferida em 15/01/2024"
    }
  ],
  "formatted_response": "Olá João! Encontrei 2 processos vinculados ao seu cadastro..."
}
```

---

## Parte 3: Hook `useNotificationLogs`

### Arquivo: `src/hooks/advbox/useNotificationLogs.ts`

**Funções:**
- `loadLogs(agentId, filters)` - Carregar logs com paginação
- `resendNotification(logId)` - Reenviar notificação que falhou
- Filtros: status, período, regra, telefone

---

## Parte 4: Hook `useClientQueries`

### Arquivo: `src/hooks/advbox/useClientQueries.ts`

**Funções:**
- `loadQueries(agentId, filters)` - Carregar histórico de consultas
- Filtros: período, tipo de consulta, telefone
- Estatísticas: tempo médio de resposta, processos encontrados

---

## Parte 5: Página `LogsPage`

### Arquivo: `src/pages/advbox/LogsPage.tsx`

**Funcionalidades:**
- Tabela paginada de logs de notificações
- Filtros por status (enviada/pendente/falha), período, regra
- Badge visual de status com cores (verde/amarelo/vermelho)
- Botão "Reenviar" para notificações com falha
- Detalhes expandíveis com mensagem completa e erro

---

## Parte 6: Página `QueriesPage`

### Arquivo: `src/pages/advbox/QueriesPage.tsx`

**Funcionalidades:**
- Tabela de histórico de consultas de clientes
- Colunas: Data, Cliente, Telefone, Tipo, Processos Encontrados, Tempo
- Filtros por período e tipo de consulta
- Estatísticas agregadas (total consultas, média de processos)

---

## Parte 7: Atualização de Rotas

### Arquivo: `src/App.tsx`

Adicionar rotas:
```typescript
import AdvboxLogsPage from "./pages/advbox/LogsPage";
import AdvboxQueriesPage from "./pages/advbox/QueriesPage";

<Route path="/advbox/logs" element={<AdvboxLogsPage />} />
<Route path="/advbox/consultas" element={<AdvboxQueriesPage />} />
```

---

## Parte 8: Atualização da IntegrationPage

Adicionar links rápidos para as novas páginas:
- Histórico de Notificações (`/advbox/logs`)
- Consultas de Clientes (`/advbox/consultas`)

---

## Parte 9: Secrets Necessários

| Secret | Descrição | Ação |
|--------|-----------|------|
| `ADVBOX_ENCRYPTION_KEY` | Chave 32 caracteres para criptografia XOR dos tokens | Solicitar ao usuário |
| `N8N_HUB_SEND_URL` | URL do webhook n8n para envio de WhatsApp | Solicitar ao usuário |

---

## Parte 10: Verificação das Tabelas (Banco Externo)

As 6 tabelas do Advbox precisam existir no banco externo:
- `advbox_integrations`
- `advbox_notification_rules`
- `advbox_processes_cache`
- `advbox_notification_logs`
- `advbox_client_queries`
- `advbox_lead_sync`

**Nota:** As tabelas são criadas no banco externo (não no Supabase) e o SQL foi especificado no plano original. Se ainda não foram criadas, será necessário executá-las manualmente.

---

## Ordem de Implementação

| # | Arquivo | Tipo |
|---|---------|------|
| 1 | `supabase/functions/advbox-notify/index.ts` | Edge Function |
| 2 | `supabase/functions/advbox-query/index.ts` | Edge Function |
| 3 | `src/hooks/advbox/useNotificationLogs.ts` | Hook |
| 4 | `src/hooks/advbox/useClientQueries.ts` | Hook |
| 5 | `src/pages/advbox/LogsPage.tsx` | Página |
| 6 | `src/pages/advbox/QueriesPage.tsx` | Página |
| 7 | `src/App.tsx` | Rotas |
| 8 | `src/pages/advbox/IntegrationPage.tsx` | Atualizar links |
| 9 | Solicitar Secrets ao usuário | Configuração |

---

## Resumo de Arquivos

### Novos Arquivos (6):
- `supabase/functions/advbox-notify/index.ts`
- `supabase/functions/advbox-query/index.ts`
- `src/hooks/advbox/useNotificationLogs.ts`
- `src/hooks/advbox/useClientQueries.ts`
- `src/pages/advbox/LogsPage.tsx`
- `src/pages/advbox/QueriesPage.tsx`

### Arquivos Atualizados (2):
- `src/App.tsx` - Adicionar rotas `/advbox/logs` e `/advbox/consultas`
- `src/pages/advbox/IntegrationPage.tsx` - Adicionar links rápidos

