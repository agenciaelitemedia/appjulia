

## Plano: Iniciar conversa manualmente no Atendimento Humano

### O que será feito
Adicionar um campo fixo no rodapé da lista de conversas (como na imagem de referência) com código do país (+55), campo de telefone e botão "Conversar". Ao clicar, abre um popup para digitar a primeira mensagem. Ao enviar:
1. A mensagem é enviada via WhatsApp (usando o mesmo fluxo do chat — waba-send ou UaZapi)
2. Um card é criado no CRM da Julia (`crm_atendimento_cards`) na etapa "Atendimento Humano"
3. O responsável (`owner_name`) é definido como o usuário logado
4. A conversa é aberta automaticamente na área de chat

### Arquivos a criar

**1. `src/pages/atendimento-humano/components/StartConversationFooter.tsx`**
- Barra fixa no rodapé da sidebar com:
  - Select de código do país (padrão +55)
  - Input de telefone com placeholder "(00) 0000-0000"
  - Botão "Conversar"
- Ao clicar "Conversar", abre o dialog de primeira mensagem

**2. `src/pages/atendimento-humano/components/StartConversationDialog.tsx`**
- Dialog com:
  - Alerta informativo: "A mensagem será enviada através do número de WhatsApp da Julia IA do agente selecionado"
  - Campo de texto para a primeira mensagem
  - Botões Cancelar / Enviar
- Ao enviar:
  1. Busca a etapa "Atendimento Humano" via `SELECT id FROM crm_atendimento_stages WHERE name = 'Atendimento Humano' LIMIT 1`
  2. Verifica se já existe card para o número/agente
  3. Se não existe, cria via `INSERT INTO crm_atendimento_cards` com `owner_name = user.name`, `stage_id` da etapa, `cod_agent` do agente selecionado
  4. Cria sessão inativa (`julia_sessions`) se necessário
  5. Envia a mensagem via waba-send ou UaZapi (mesmo fluxo do `handleSendMessage` do WhatsAppMessagesDialog)
  6. Abre a conversa no painel de chat (via callback `onStartConversation`)

### Arquivos a modificar

**3. `src/pages/atendimento-humano/components/InactiveLeadsList.tsx`**
- Adicionar o `StartConversationFooter` abaixo do `ScrollArea`, antes do fechamento do container
- Passar props: `codAgent`, `onStartConversation`

**4. `src/pages/atendimento-humano/HumanSupportPage.tsx`**
- Adicionar callback `handleStartConversation(whatsappNumber)` que:
  - Define o lead selecionado com os dados do novo card
  - Faz refetch da lista de leads
- Passar `selectedAgent` e callback para `InactiveLeadsList`

### Detalhes técnicos
- Usa `externalDb.raw()` para consultas SQL (buscar stage, inserir card)
- Usa `externalDb.insert()` para criar o card
- Reutiliza lógica de envio de mensagem do `WhatsAppMessagesDialog` (detecta provider via credenciais do agente, usa waba-send ou UaZapi)
- O campo de telefone aceita apenas números, formatação automática
- Número enviado no formato `55XXXXXXXXXXX` (código país + DDD + número)

