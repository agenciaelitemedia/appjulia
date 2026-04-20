

## Adicionar botão "Desconectar" para filas WABA (API Oficial)

### Contexto
Hoje no card de fila (`QueueCard`), apenas filas UaZapi mostram QR Code / status de conexão. Filas WABA (`channel_type = 'waba'`) usam token permanente da Meta — não há sessão para "desconectar" no sentido WhatsApp Web, mas faz sentido permitir **revogar/limpar as credenciais** localmente para forçar reconfiguração.

### Comportamento proposto

Botão **"Desconectar"** no card de fila WABA:
- Aparece só quando `channel_type === 'waba'` E há credenciais salvas (`waba_token` preenchido).
- Ao clicar → dialog de confirmação ("Isso vai remover o token e desativar a fila. Você precisará reconectar via Embedded Signup.")
- Confirmação → chama `update` da queue limpando `waba_token`, `waba_id`, `waba_number_id` e setando `is_active = false`.
- Toast de sucesso + refetch da lista.

### Arquivos a editar

1. **`src/pages/agente/filas/components/QueueCard.tsx`**
   - Adicionar botão "Desconectar" (ícone `Unplug`/`PowerOff`, variant outline destrutivo) condicional ao tipo WABA + presença de token.
   - Estado local para abrir dialog de confirmação.

2. **`src/pages/agente/filas/components/DisconnectWabaDialog.tsx`** (novo)
   - AlertDialog com mensagem explicativa.
   - Ao confirmar, chama `updateQueue.mutate({ queue_id, waba_token: null, waba_id: null, waba_number_id: null, is_active: false })`.

3. **`supabase/functions/queue-management/index.ts`** — sem mudança
   - O `update` action já aceita esses campos e os trata como `null` se vierem vazios.

### Não-quebra
- Filas UaZapi continuam com fluxo de QR Code intocado.
- Filas WABA sem token nunca mostram o botão.
- Vínculos com agentes (`queue_agent_links`) preservados — apenas as credenciais Meta são limpas.

### Pergunta de escopo
Se você quiser ir além e **revogar o token na Meta também** (chamar Graph API para invalidar o `access_token`), me avise — exige uma Edge Function adicional (`waba-disconnect`) com `DELETE /{app-id}/permissions`. O plano acima faz só desconexão local, que é o suficiente em 99% dos casos.

