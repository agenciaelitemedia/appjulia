
# Plano: Correção do Tipo de client_id nas Tabelas de Chat

## Problema Identificado

O sistema de chat está quebrando porque há uma incompatibilidade de tipos:

| Componente | Tipo Usado |
|------------|-----------|
| AuthContext (user.id) | `number` (ex: 2) |
| chat_contacts.client_id | `UUID` (ex: 550e8400-e29b-41d4-a716-446655440000) |

A query `client_id=eq.2` falha porque `"2"` não é um UUID válido.

## Solução Proposta

Alterar o tipo da coluna `client_id` de `UUID` para `TEXT` em ambas as tabelas, permitindo armazenar o ID numérico como string.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL (nova) | Alterar tipo das colunas |
| src/contexts/WhatsAppDataContext.tsx | Nenhuma (já usa String(user.id)) |

---

## Migration SQL

```sql
-- Alterar client_id de UUID para TEXT em chat_contacts
ALTER TABLE public.chat_contacts 
  ALTER COLUMN client_id TYPE TEXT;

-- Alterar client_id de UUID para TEXT em chat_messages
ALTER TABLE public.chat_messages 
  ALTER COLUMN client_id TYPE TEXT;

-- Atualizar RLS policies para usar o novo tipo
-- (As policies existentes já usam 'true' então não precisam de alteração)
```

---

## Resultado Esperado

Após a migração:
- A query `client_id=eq.2` funcionará corretamente
- Os contatos e mensagens serão armazenados com o ID do usuário do banco externo
- A tela de chat carregará sem erros

---

## Seção Técnica

### Por que TEXT ao invés de INTEGER?

1. **Compatibilidade**: O código atual já usa `String(user.id)`
2. **Flexibilidade**: Permite IDs numéricos e alfanuméricos no futuro
3. **Performance**: Índices em TEXT são eficientes para este caso de uso

### Verificação do Código Existente

O `WhatsAppDataContext.tsx` já está preparado para usar string:
```typescript
// Linha 197
const clientId = user?.id ? String(user.id) : '';

// Linha 210
.eq('client_id', clientId)  // Já passa como string
```

### Impacto nas Tabelas

- `chat_contacts`: Coluna `client_id` muda de `UUID NOT NULL` para `TEXT NOT NULL`
- `chat_messages`: Coluna `client_id` muda de `UUID NOT NULL` para `TEXT NOT NULL`
- Nenhum dado será perdido (tabelas estão vazias)

