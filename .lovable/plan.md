
## Diagnóstico do Bug

O webhook `uazapi-chat-webhook` confunde **remetente** com **destinatário** quando a mensagem é `fromMe=true` (enviada pelo próprio dono da instância no celular):

**Payload UaZapi para `fromMe=true`:**
- `chatid` = telefone do **destinatário** (ex: Dra Michele `5511940108228`)
- `sender` / `sender_pn` = telefone do **dono da instância** (ex: Mário `553488860163`)
- `senderName` = "Mário Castro" (nome do dono)

**Bug atual** (`uazapi-chat-webhook/index.ts`):
1. A resolução de `senderPhone` percorre `[chatid, chatId, sender_pn, PhoneNumber, phone, from, sender, ...]`. Quando `chatid` está presente, dá certo. Mas em vários casos o webhook também usa `sender_pn` como fallback — e quando `chatid` falha por qualquer motivo (LID, formato, etc.), pega o número do dono.
2. Pior: o `pushName` (`senderName: "Mário Castro"`) é gravado como `name` do contato no upsert. Para mensagens `fromMe=true`, isso sobrescreve o nome do destinatário com o nome do dono.
3. Resultado: contatos "Mário Castro" aparecem com telefones diferentes (do destinatário), e mensagens enviadas do celular caem em contatos errados / criam novos.

**Conversas duplicadas:** quando o mesmo destinatário tem 2+ contatos (um certo + um "Mário Castro"), cada um abre conversa separada → vários chats para o mesmo número.

## Correção

### A. `supabase/functions/uazapi-chat-webhook/index.ts`

1. **Determinar `peerPhone` (o "outro lado") por direção**:
   - Se `fromMe === true`: `peerPhone = chatid` (destinatário). NUNCA usar `sender`/`sender_pn`/`participant` (esses são o dono).
   - Se `fromMe === false`: prioridade `chatid` → `sender_pn` → `sender` (excluindo `@lid`).
   - Validar 8–13 dígitos como já está.

2. **`pushName` só para mensagens recebidas**:
   - Se `fromMe === true`: NÃO usar `pushName`/`senderName` para nomear o contato (são do dono).
   - Se `fromMe === false`: usar `pushName` normalmente.

3. **Não sobrescrever nome do contato em upsert se for `fromMe`**:
   - Para `fromMe=true`, no upsert NÃO mandar `name` (deixar o existente). Se contato é novo e não temos nome, usar o phone como fallback.

4. **`sender_name` da mensagem**:
   - Para `fromMe=true`: gravar `null` (ou nome do operador interno, não do payload).
   - Para `fromMe=false`: gravar `pushName`.

5. **Reforçar filtro de grupo**: já checa `@g.us`/`isGroup`, mas adicionar checagem de `groupName` presente como sinal extra (alguns payloads marcam só por `groupName`).

### B. Limpeza de dados existentes

1. **Remover contatos "Mário Castro" duplicados** (todos exceto o real do dono, se houver) — após mapear cada um para o destinatário correto via `chatid` das mensagens.
2. **Mesclar mensagens** desses contatos órfãos para o contato correto baseado no `chatid` da mensagem (lookup em `chat_contacts.phone`).
3. **Remover conversas órfãs** após o merge (DELETE em conversations sem mensagens associadas).
4. **Reset `unread_count`** dos contatos afetados.

Estratégia segura — em vez de tentar mesclar (arriscado por causa de FK e protocolos), **apagar tudo de novo** dos contatos sintéticos errados:
   - DELETE messages, conversations, contacts criados pelo bug.
   - Webhook + backfill automático recriam corretamente quando chegarem novas mensagens.

### C. Validação

1. Enviar mensagem do celular do Mário para um contato → deve aparecer no chat **daquele contato**, não criar "Mário Castro".
2. Receber mensagem desse contato → mesmo chat (mesmo `chat_contacts.id`).
3. Confirmar que `chat_contacts.name` mostra o nome real do destinatário, nunca "Mário Castro".

### Arquivos a editar
- `supabase/functions/uazapi-chat-webhook/index.ts` — lógica de direção (peerPhone), pushName condicional, upsert sem sobrescrever nome em fromMe.
- Migration / script de limpeza dos contatos+conversas órfãos.
