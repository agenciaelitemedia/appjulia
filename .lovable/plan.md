

## Plano: Corrigir race condition no versionamento de alterações

### Diagnóstico
Os logs estão sendo criados no banco, mas a listagem não os exibe porque:
1. Em `useAgentUpdate.ts`, o `insertAgentChangeLog` está no bloco `finally`, que executa APÓS o `return { success: true }` do `try`
2. Na `EditAgentPage.tsx`, a invalidação do cache `agents-last-changes` acontece imediatamente após receber `result.success`, antes do `finally` completar a inserção do log
3. Resultado: a listagem busca os dados antes do log existir no banco

### Correção

**1. `useAgentUpdate.ts`** — Mover log para DENTRO do try, ANTES do return
- Mover `insertAgentChangeLog` para dentro do bloco `try`, logo antes de `return { success: true }`
- Isso garante que o log é inserido ANTES da função retornar o resultado ao chamador
- Manter tratamento de erro não-bloqueante (try/catch interno)

```
try {
  await updateClient(...);
  await updateAgent(...);
  
  // Log ANTES de retornar
  try {
    await insertAgentChangeLog({...});
  } catch (logErr) {
    console.warn('Change log failed:', logErr);
  }
  
  return { success: true, error: null };
} catch (error) { ... }
finally { setIsSaving(false); }
```

**2. `EditAgentPage.tsx`** — Adicionar pequeno delay antes de invalidar
- Opcional: garantir que a invalidação force um refetch real com `{ exact: false }`

### Resultado
O log será gravado ANTES do caller receber sucesso, garantindo que a invalidação do cache já encontre o registro no banco.

