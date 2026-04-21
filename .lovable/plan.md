

## Auto-criar configuração de Chat ao criar/editar agente

### Comportamento

Ao salvar (criar OU editar) um agente, garantir que existe um registro em `chat_client_settings` para o `client_id` daquele agente. Se não existir, criar com os defaults (`QUEUE_LIMIT=1`, `ALLOW_GROUPS=false`). Se já existir, não mexer.

### Implementação

**Novo helper: `src/lib/ensureChatClientSettings.ts`**

```ts
export async function ensureChatClientSettings(
  clientId: number | string,
  clientName?: string | null,
  clientBusinessName?: string | null,
): Promise<void> {
  const cid = String(clientId);
  // Verifica existência
  const { data: existing } = await supabase
    .from('chat_client_settings')
    .select('id')
    .eq('client_id', cid)
    .maybeSingle();
  if (existing) return;

  // Cria com defaults
  await supabase.from('chat_client_settings').insert({
    client_id: cid,
    client_name: clientName ?? null,
    client_business_name: clientBusinessName ?? null,
    settings: { QUEUE_LIMIT: 1, ALLOW_GROUPS: false },
  });
}
```

Falha silenciosa (apenas `console.warn`) — não pode quebrar o fluxo de salvar agente.

### Pontos de chamada

**1. Criar agente — `src/pages/agents/hooks/useAgentSave.ts`**

Após o `insertAgent` ser bem-sucedido (logo antes do `insertAgentChangeLog`), chamar:
```ts
await ensureChatClientSettings(
  createdClientId,
  data.new_client ? data.client_name : null,
  data.new_client ? data.client_business_name : null,
);
```

> Quando `new_client=false`, name/business_name ficam `null` no insert — o registro fica criado e o admin pode completar depois pela aba Chat (a coluna é nullable).

**2. Editar agente — admin**

Identificar o hook/handler de update do admin (`src/pages/agents/hooks/` — provavelmente `useAgentUpdate.ts` ou equivalente). Após o update do agente, chamar `ensureChatClientSettings(agent.client_id)`.

**3. Editar agente — proprietário (`MyAgentEditPage.tsx`)**

No `handleSave`, após `updateAgentByOwner`, chamar `ensureChatClientSettings(user.client_id)` (passando o `client_id` do usuário logado, que é o mesmo do agente).

### Arquivos editados

- **Novo**: `src/lib/ensureChatClientSettings.ts`
- **Editado**: `src/pages/agents/hooks/useAgentSave.ts` — chamar helper após criar agente
- **Editado**: hook/handler de update do agente no admin (a confirmar pelo nome real do arquivo durante a implementação) — chamar helper após update
- **Editado**: `src/pages/agente/meus-agentes/MyAgentEditPage.tsx` — chamar helper após salvar

### Resultado

Todo agente criado ou editado garante a existência de um registro em `chat_client_settings` para o seu `client_id`, com defaults seguros (1 fila, sem grupos). O admin pode então ajustar pela aba `/configuracoes → Chat` quando quiser. Não há duplicação (verificação prévia por `client_id`, que já é `UNIQUE` na tabela).

