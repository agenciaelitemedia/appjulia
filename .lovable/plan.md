
## Vincular usuário ao cliente via `client_id` na tabela `users`

### Problema identificado
Ao criar um novo agente com novo usuário, o sistema não está preenchendo o campo `client_id` na tabela `users`. Por isso, quando o usuário faz login, o `client_id` retorna `null` e a página de perfil não consegue carregar os dados do cliente.

Conforme a requisição de login retornou:
```json
{"client_id": null, ...}
```

### Causa raiz
A ação `insert_user` na Edge Function não recebe nem grava o `client_id`:

```sql
INSERT INTO users (name, email, password, remember_token, role, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'user', now(), now())
```

### Mudanças a implementar

#### 1. Edge Function - Adicionar `client_id` no INSERT de usuário

**Arquivo:** `supabase/functions/db-query/index.ts`

**Ação `insert_user` (linhas 477-486):**
```sql
INSERT INTO users (name, email, password, remember_token, role, client_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, 'user', $5, now(), now())
RETURNING id, name, email
```

Parâmetros: `[name, email, hashedPassword, rawPassword, clientId]`

---

#### 2. Frontend - Passar `clientId` para a ação `insert_user`

**Arquivo:** `src/lib/externalDb.ts`

**Método `insertUser`:**
Adicionar parâmetro `clientId` na assinatura:

```typescript
async insertUser(name: string, email: string, hashedPassword: string, rawPassword: string, clientId: number): Promise<{ id: number; name: string; email: string }> {
  const result = await this.invoke({
    action: 'insert_user',
    data: { name, email, hashedPassword, rawPassword, clientId },
  });
  return result[0];
}
```

---

#### 3. Hook de criação - Passar `clientId` ao criar usuário

**Arquivo:** `src/pages/agents/hooks/useAgentSave.ts`

**Trecho (linhas 146-151):**
O `insertUser` é chamado antes de criar o cliente quando é novo usuário, mas o `createdClientId` já está disponível neste ponto. Ajustar a chamada:

```typescript
const userResult = await externalDb.insertUser(
  data.user_name,
  data.user_email,
  hashedPassword,
  tempPassword,
  createdClientId  // Adicionar este parâmetro
);
```

---

### Consideração sobre usuários existentes

Usuários existentes que já têm `client_id = null` não serão afetados por esta mudança. Se necessário, seria preciso:
1. Criar uma ação para atualizar o `client_id` de um usuário existente
2. Ou executar um UPDATE manual no banco para vincular usuários antigos

---

### Resumo das alterações por arquivo

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/db-query/index.ts` | Adicionar `client_id` no INSERT da ação `insert_user` |
| `src/lib/externalDb.ts` | Adicionar parâmetro `clientId` ao método `insertUser` |
| `src/pages/agents/hooks/useAgentSave.ts` | Passar `createdClientId` na chamada de `insertUser` |

---

### Resultado esperado

Após implementação:
- Novos usuários criados terão o `client_id` vinculado corretamente
- Ao fazer login, o `client_id` virá preenchido
- A página de perfil carregará os dados do cliente automaticamente
