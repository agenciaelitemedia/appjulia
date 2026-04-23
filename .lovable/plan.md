

## Excluir fila UaZapi também deleta a instância no servidor UaZapi

### Diagnóstico
Hoje, ao excluir uma fila do tipo `uazapi` no `/agente/filas`:

1. O frontend chama `queue-management` action `delete`
2. O backend faz **apenas soft delete** (`is_deleted=true`) na tabela `queues`
3. **Nada é enviado ao servidor UaZapi** — a instância continua viva, consumindo slot, mantendo sessão WhatsApp e webhook ativos

A função `uazapi-instance-manager` nem sequer expõe uma ação `delete` (só `create`, `connect`, `status`, `disconnect`, `reconfigure_webhook`). A função `uazapi-admin` tem `delete_instance`, mas é usada só pelo fluxo de "Meus Agentes" — não pelo fluxo de filas.

### Correção

#### 1. Adicionar action `delete` em `uazapi-instance-manager`
Arquivo: `supabase/functions/uazapi-instance-manager/index.ts`

- Recebe `queue_id`
- Busca credenciais da fila (`evo_url`, `evo_apikey`, `evo_instance`)
- Chama `DELETE {evo_url}/instance` com header `token: {evo_apikey}` (mesmo endpoint usado em `uazapi-admin`)
- Fallback com `admintoken` em caso de 401
- Tratamento resiliente: 404/410 (instância já não existe) é considerado sucesso
- Retorna `{ success, data }`

#### 2. Disparar a exclusão da instância dentro de `queue-management` action `delete`
Arquivo: `supabase/functions/queue-management/index.ts`

Antes do soft delete da fila:

- Buscar a fila no banco (`channel_type`, `evo_url`, `evo_apikey`, `evo_instance`)
- Se `channel_type === 'uazapi'` e existe `evo_instance` + `evo_apikey`, chamar `uazapi-instance-manager` action `delete`
- Logar o resultado mas **não bloquear** o soft delete em caso de falha (a fila precisa sumir do painel mesmo se a UaZapi estiver fora do ar) — registrar `instance_warning` na resposta

Fluxo final:

```text
delete fila uazapi
   -> verifica vínculos / conversas (já existe)
   -> migra conversas se necessário (já existe)
   -> NOVO: chama uazapi-instance-manager.delete -> DELETE /instance na UaZapi
   -> soft delete da fila (is_deleted=true)
```

#### 3. Mesma proteção no `restore` (opcional, fora deste escopo)
Restaurar uma fila UaZapi com a instância já deletada não vai reconectar sozinho — manter o comportamento atual (só desfaz o soft delete) e o usuário precisa reconectar manualmente via QR. Sem mudança aqui.

### Arquivos afetados
- `supabase/functions/uazapi-instance-manager/index.ts` — nova action `delete`
- `supabase/functions/queue-management/index.ts` — chamar a nova action no fluxo de delete

### Validação
1. Criar fila UaZapi → confirma que a instância aparece em `/admin/instances` da UaZapi
2. Excluir a fila pelo painel `/agente/filas`
3. Conferir nos logs do `uazapi-instance-manager` o `DELETE /instance` com 200
4. Confirmar via `list_instances` que a instância sumiu do servidor UaZapi
5. Fila aparece como soft-deleted no painel (não some, mas marcada como excluída)
6. Caso a UaZapi esteja indisponível, fila ainda é excluída no painel e retorna `instance_warning`

