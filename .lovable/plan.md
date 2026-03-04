

## Busca por lista de cod_agent separados por vírgula

Alterar apenas a função `filterAgent` em `MonitoramentoEditor.tsx`:

Quando o termo de busca contiver vírgulas, interpretar como lista de `cod_agent`. Separar por vírgula, fazer trim em cada valor, e verificar se o `cod_agent` do agente está na lista. Caso contrário, manter o comportamento atual (busca por nome/escritório/cod).

```typescript
const filterAgent = (agent: any, term: string) => {
  if (!term) return true;
  if (term.includes(',')) {
    const codes = term.split(',').map(c => c.trim()).filter(Boolean);
    return codes.includes(agent.cod_agent?.toString());
  }
  const t = term.toLowerCase();
  return (
    agent.client_name?.toLowerCase().includes(t) ||
    agent.business_name?.toLowerCase().includes(t) ||
    agent.cod_agent?.toString().includes(t)
  );
};
```

Arquivo: `src/pages/admin/monitoramento/components/MonitoramentoEditor.tsx` — apenas a função `filterAgent` será alterada.

