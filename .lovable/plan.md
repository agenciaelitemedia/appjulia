## Objetivo
Adicionar configuração na aba **Máscara de Protocolo** (`/tickets`) para enviar automaticamente o protocolo ao WhatsApp do solicitante assim que o ticket é aberto.

## Escopo

### 1. Banco — `support_settings`
Migration adicionando dois campos:
- `protocol_auto_send boolean NOT NULL DEFAULT false`
- `protocol_send_template text NOT NULL DEFAULT 'Olá {nome}! Seu chamado foi aberto. Protocolo: {protocolo}. Assunto: {assunto}.'`

### 2. UI — `src/pages/tickets/components/SupportSettingsTab.tsx`
Dentro do card "Máscara de Protocolo", abaixo dos tokens, adicionar:
- `Switch` "Enviar protocolo automaticamente ao abrir o ticket" (vinculado a `protocol_auto_send`).
- `Textarea` "Mensagem enviada com o protocolo" (vinculado a `protocol_send_template`), com helper listando placeholders disponíveis: `{protocolo}`, `{numero}`, `{assunto}`, `{nome}`, `{prioridade}`.
- Botão "Salvar máscara" passa a salvar os 3 campos juntos (`protocol_mask`, `protocol_auto_send`, `protocol_send_template`).
- Textarea desabilitado quando o switch está off (visual feedback).

### 3. Tipos — `src/pages/tickets/types.ts`
Estender `SupportSettings` com `protocol_auto_send: boolean` e `protocol_send_template: string`.

### 4. Lógica de envio — `src/pages/tickets/hooks/useTickets.ts` (mutation `create`)
Após `insert` do ticket bem-sucedido, se:
- `settings.protocol_auto_send === true`
- ticket tem `protocol` gerado
- `input.contact_id` definido
- Conseguir resolver `queue_id` (via `chat_conversations.queue_id` quando houver `conversation_id`; caso contrário pular silenciosamente — não bloqueia criação)

Então:
- Renderizar o template substituindo `{protocolo}`, `{numero}`, `{assunto}`, `{nome}`, `{prioridade}`.
- Chamar a função existente `dispatchToWhatsApp(...)` (já cuida de WABA/UaZapi + persistência em `chat_messages`).
- Registrar `logEvent(ticketId, 'whatsapp_protocol_sent', ...)`.
- Falha do envio NÃO derruba a criação do ticket (try/catch silencioso + toast warning opcional via retorno).

### 5. Detalhes técnicos
- Sem novas Edge Functions; reuso de `dispatchToWhatsApp` já existente no hook.
- Sem alterações em RLS (campos novos na mesma linha singleton `id='global'`).
- Sem mudanças no componente `ChatTicketSidePanel` — ele continua chamando `create.mutateAsync` normalmente; o envio é transparente.

## Fora do escopo
- Não altera fluxo de respostas (`reply`) nem envio manual.
- Não envia para tickets criados sem `contact_id` (ex.: chamado interno sem origem em chat).
