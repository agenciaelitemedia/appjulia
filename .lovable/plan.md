## Objetivo
Antes de enviar a primeira mensagem no diálogo "Novo atendimento" (`NewConversationDialog`), verificar se já existe uma conversa **pending/open** para aquele telefone no `client_id`. Se existir, oferecer ao usuário: **(A)** abrir a conversa existente no chat, ou **(B)** encerrar a anterior e iniciar uma nova já atribuída a ele.

Sem mudanças em filas, webhooks, triggers ou outros fluxos.

## Fluxo proposto

```
[Usuário preenche fila/telefone/mensagem] → clique "Conversar"
        │
        ▼
[Pré-check: existe conversa pending|open p/ esse phone no client?]
        │
   ┌────┴────┐
   │ NÃO     │ SIM
   │         │
   ▼         ▼
[envia    [Mostra card: "Já existe atendimento em <Fila X>
mensagem   com <responsável>, aberto há <tempo>"]
normal]    ┌───────────────┬────────────────┐
           │ Abrir existente│ Iniciar nova  │
           ▼                ▼
    setSelectedQueue   1) UPDATE conversa antiga → resolved
    + selectContact       (+ close_note "[manual] usuário X iniciou novo atendimento na fila Y")
    + fecha dialog        + history action='manual_closed_for_new_conversation'
                       2) getOrCreateConversation no contato/fila nova
                          (cria/recupera + assigned_to = user.cod_agent, status='open')
                       3) envia mensagem via UaZapi
                       4) selectContact + fecha dialog
                          → aparece em "Meus atendimentos"
```

## Mudanças (somente frontend, escopo cirúrgico)

### 1. `src/components/chat/NewConversationDialog.tsx`
- Após validar telefone + fila + mensagem, **antes de enviar**, fazer query:
  ```ts
  const variants = brPhoneVariants(cleanPhone); // já existe em src/lib/phoneNormalize
  const { data: contacts } = await supabase
    .from('chat_contacts')
    .select('id, name, phone')
    .eq('client_id', clientId)
    .in('phone', variants)
    .limit(5);

  const contactIds = contacts?.map(c => c.id) ?? [];
  const { data: active } = contactIds.length ? await supabase
    .from('chat_conversations')
    .select('id, contact_id, queue_id, status, assigned_to, opened_at, channel')
    .eq('client_id', clientId)
    .in('contact_id', contactIds)
    .in('status', ['pending','open'])
    .order('updated_at', { ascending: false })
    .limit(5) : { data: [] };
  ```
- Buscar nome da fila ativa via `queues` (id → name) para exibir.
- Novo estado interno: `mode: 'form' | 'conflict' | 'sending'`.
- Render condicional do conteúdo do `DialogContent`:
  - `form`: igual hoje.
  - `conflict`: card de aviso com nome do contato, fila atual, responsável (se houver), protocolo se útil, e dois botões: **"Abrir conversa existente"** / **"Encerrar e iniciar nova"** + **"Cancelar"**.
- Handlers:
  - `handleOpenExisting(conv, contact)`: usa `writePendingSelection({ contactId: conv.contact_id, queueId: conv.queue_id })` (mesma ponte já usada em `ChatPage`) e fecha dialog. Se já estiver em `/chat`, força o efeito existente lendo o pending. Se o `selectedQueue` atual divergir, também chama `setSelectedQueue` via callback opcional passado pelo pai (ou apenas o pending; o `ChatPage` já hidrata a fila).
  - `handleCloseAndStartNew(active, contact)`:
    1. `UPDATE chat_conversations SET status='resolved', resolved_at=now(), close_note=coalesce(close_note,'')||' [manual] Encerrada para novo atendimento na fila <X> por <usuário>' WHERE id IN (...)` — só nas conversas em conflito **e que sejam de fila diferente da escolhida** (se for a mesma fila, basta reabrir).
    2. INSERT em `chat_conversation_history` com `action='manual_closed_for_new_conversation'`.
    3. Garantir contact (find ou insert via mesma lógica já existente — reaproveitar `getOrCreateConversation` exigiria injetar do contexto). Como o dialog hoje não tem acesso ao contexto: criar o contato direto via `supabase.from('chat_contacts').upsert({...}, { onConflict: 'client_id,channel_source,phone' })`, mesma forma usada em `WhatsAppDataContext.loadContacts`.
    4. INSERT `chat_conversations` com `client_id, contact_id, queue_id=selectedQueue.id, channel=<map do channel_type>, status='open', assigned_to=user.cod_agent, opened_at=now()` (o trigger `auto_open_on_insert_assignment` cuida do open; `auto_resolve_prior_queue_conversations` cuida de fechar de outras filas; ambos já existem).
    5. Envia a mensagem via UaZapi (igual hoje).
    6. Aciona pending selection para abrir a conversa no `/chat` e fecha dialog.

- Props novas (mínimas): receber `clientId: string` e `currentUser: { cod_agent: string; name: string }` do pai (ChatList e DealCard). Hoje o dialog não conhece o usuário; será exposto via props para não criar acoplamento com contexto.

### 2. `src/components/chat/ChatList.tsx`
- Passar `clientId={user?.client_id}` e `currentUser={{ cod_agent: user?.cod_agent, name: user?.name }}` para `<NewConversationDialog />`.
- Sem outras mudanças.

### 3. `src/pages/crm-builder/components/deals/DealCard.tsx`
- Mesmas duas props adicionais (já tem acesso ao `useAuth`).

### 4. `src/lib/chat/pendingSelection.ts`
- Sem alteração se já expõe `writePendingSelection({ contactId, queueId })`. Caso a função não exista com esse nome, criar wrapper minúsculo (a leitura `readPendingSelection` já existe e o `ChatPage` consome).

## Detalhes técnicos
- **Variantes de telefone**: usar `brPhoneVariants` (com/sem 9º dígito) já presente. Cobre o caso de o usuário digitar `5511988887777` quando o contato salvo está como `551188887777`.
- **Channel map**: `channel_type='uazapi' → channel='whatsapp_uazapi'`; `'waba' → 'whatsapp_waba'`. Já feito no contexto, replicar a mesma constante curta dentro do dialog.
- **Idempotência**: se não houver conflito (caminho atual), o comportamento é **idêntico** ao de hoje — nenhum efeito colateral.
- **Encerramento manual**: usa `status='resolved'` (mesma semântica dos auto-resolves) para não disparar reabertura indevida e para que o contador "Em atendimento" desconte. Não toca em `updated_at` para preservar o leader (regra já documentada em `auto-resolve-on-queue-switch`).
- **Atribuição**: `assigned_to=user.cod_agent` no INSERT — aparece imediatamente em "Meus atendimentos" pela mesma query existente.
- **Sem mudanças de schema, RLS, triggers, edge functions ou webhooks.**

## QA manual
1. Telefone novo → envia normal (sem prompt).
2. Telefone com conversa **open na mesma fila** → prompt aparece; "Abrir existente" foca a conversa.
3. Telefone com conversa **open em outra fila** → prompt aparece; "Encerrar e iniciar nova" fecha a antiga, cria nova na fila escolhida, atribui ao usuário, envia mensagem, abre no chat e aparece em "Meus".
4. Telefone com conversa **pending sem responsável** → "Abrir existente" mantém pendente; "Encerrar e iniciar nova" segue o fluxo acima.
5. Abrir pelo `DealCard` do CRM com `lockContact` → mesmo fluxo.
