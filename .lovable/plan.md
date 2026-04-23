

## Por que a lista do /chat mostra poucos chats apesar de 400+ pendentes

### Diagnóstico (dados reais do client 30)

- `chat_conversations` com `status = 'pending'`: **436**
  - 239 apontam para contatos **individuais**
  - 197 apontam para contatos de **grupo**
- `chat_contacts` carregados pela queue ativa: **459** (259 individuais + 200 grupos)
- O badge "Pendentes" mostra **436** (soma de tudo).
- A aba ativa é "Individual" → filtra grupos → cai para no máximo 239.
- Em cima disso aplicam-se filtros adicionais (`ownerFilter`, `slaFilter`, `modeFilter`, `periodFilter`, `snoozedContactIds`) em `filteredContacts` no `WhatsAppDataContext`. Cada um corta mais a lista, então o usuário acaba enxergando "poucos".

Conclusão: **o badge conta global (incluindo grupos) e a lista mostra só individuais filtrados** — a divergência é real e confusa, não há mensagem perdida.

Há também um efeito colateral: o histórico tinha gerado 200 contatos `is_group=true` em sessões anteriores (antes do fix). Eles não vêm mais do `messages.set`, mas estão no banco poluindo contagens e a aba Grupos.

### Correção proposta

#### 1. Badges por aba (contagem coerente com o que aparece)
Arquivo: `src/components/chat/ChatList.tsx`

- Em vez de `pendingCount = conversations.filter(c => c.status === 'pending').length`, calcular três valores e mostrar o que corresponde à aba ativa:
  - `pendingIndividualCount` → conversas pending cujo `contact_id` pertence a contato `is_group = false`
  - `pendingGroupCount` → conversas pending cujo `contact_id` pertence a contato `is_group = true`
  - `pendingTotal` (soma) só para a aba "Todos" se existir
- O badge ao lado do botão "Pendentes" passa a refletir o subset atualmente visível na aba.
- Mesma lógica para `openCount` e `resolvedCount`.

#### 2. Mostrar quantos chats foram cortados pelos filtros laterais
Arquivo: `src/components/chat/ChatList.tsx`

Quando `visibleContacts.length < filteredContacts.length` adicionar um aviso pequeno acima da lista:
> "Mostrando X de Y conversas (filtros ativos)" + botão "Limpar filtros".

Isso elimina a sensação de que mensagens "sumiram".

#### 3. Limpeza dos grupos criados indevidamente pelo histórico antigo
Migration utilitária (opt-in, executar uma vez):

- Deletar `chat_messages` de contatos onde `is_group = true` AND `history_backfilled = true` AND não têm mensagens em tempo real (somente backfilled).
- Deletar `chat_conversations` desses contatos.
- Deletar os contatos de grupo criados pelo histórico (`is_group = true` AND `history_backfilled = true`).

Resultado: 197 conversas pending de grupo somem da contagem; o badge passa a refletir o real (≈239).

#### 4. Verificar `ALLOW_GROUPS` do agente do client 30
Hoje grupos entram em tempo real (não via history) porque o agente tem `ALLOW_GROUPS = true`. Se a intenção é não receber grupos no /chat, basta desativar essa flag no agente — sem mudança de código.

### Arquivos afetados

- `src/components/chat/ChatList.tsx` — contagens por aba + aviso de filtros ativos.
- `supabase/migrations/<timestamp>_cleanup_history_groups.sql` — limpeza única de grupos backfilled.

### Validação

1. No /chat, abrir aba "Individual" → badge "Pendentes" mostra o número de pending **individuais** (≈239), não 436.
2. Aba "Grupos" → badge mostra pending de grupo.
3. Se filtros laterais reduzirem a lista, aparece "Mostrando X de Y".
4. Após a migration de limpeza, contatos `is_group=true history_backfilled=true` desaparecem do /chat.
5. Configurar `ALLOW_GROUPS=false` no agente impede novas entradas de grupo em tempo real (validação manual).

