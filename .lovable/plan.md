

## Correção: Cache de Status da Sessão no CRM

### Problema

O hook `useAgentSessionStatus` usa `queryKey: ['agent-session-status', codAgent]`, mas a query no banco filtra por `whatsapp_number` (do lead) E `cod_agent`. Como o cache key não inclui o `whatsapp_number`, todos os cards do mesmo agente compartilham o resultado do primeiro card que disparou a query — resultando em todos mostrando o mesmo status.

### Solução

Incluir `whatsappNumber` no `queryKey` para que cada lead tenha seu próprio cache de status de sessão.

### Arquivo a editar

**`src/hooks/useAgentSessionStatus.ts`**
- Alterar `queryKey` de `['agent-session-status', codAgent]` para `['agent-session-status', codAgent, whatsappNumber]`
- Ajustar `invalidateQueries` para invalidar por `codAgent` (prefixo), mantendo a invalidação em lote quando o dialog fecha

### Mudança exata

```typescript
// queryKey: incluir whatsappNumber
queryKey: ['agent-session-status', codAgent, whatsappNumber],

// invalidate: invalidar todos os status do agente (prefixo match)
queryClient.invalidateQueries({ 
  queryKey: ['agent-session-status', codAgent] 
});
```

A invalidação por prefixo `['agent-session-status', codAgent]` já funciona corretamente — React Query invalida todas as queries que começam com esse prefixo, cobrindo todos os leads do agente.

