

## Objetivo
Garantir que o badge "J" (Julia ativa) / "H" (Humano) apareça em cada conversa do `/chat` (lista e header), refletindo o estado atual da sessão de IA do contato — igual ao que já é exibido em `/atendimento-humano`.

## Diagnóstico
- Componente `JuliaStatusBadge` já existe (`src/components/chat/JuliaStatusBadge.tsx`) e usa `useAgentSessionStatus(whatsappNumber, codAgent)`.
- Já é usado em `/atendimento-humano`, mas **não está plugado** em `/chat` (nem no `ChatContactItem` da lista, nem no `ChatHeader`).
- Cada conversa do chat tem `chat_contacts.phone` (whatsapp) e `chat_conversations.cod_agent` — dados suficientes para o hook resolver o status.

## Mudanças

### 1. `ChatContactItem` (lista de conversas)
- Importar `JuliaStatusBadge`.
- Renderizar o badge ao lado do nome do contato, passando `whatsappNumber={contact.phone}` e `codAgent={conversation.cod_agent}`.
- Tamanho compacto (já é h-4 w-4) — não quebra layout estilo Helena (w-96).

### 2. `ChatHeader` (cabeçalho da conversa aberta)
- Importar `JuliaStatusBadge`.
- Renderizar ao lado do nome do contato no topo, mesmo padrão.

### 3. (Opcional, se houver dados disponíveis) Realtime
- O hook `useAgentSessionStatus` já lida com polling/realtime (manter comportamento atual). Sem alteração.

## Comportamento legado preservado
- Conversas sem `cod_agent` ou sem `phone` válido: hook retorna `null` → badge não aparece (comportamento atual do componente).
- Nenhuma mudança em `/atendimento-humano`.

## Arquivos previstos
- `src/components/chat/ChatContactItem.tsx` — adicionar badge.
- `src/components/chat/ChatHeader.tsx` — adicionar badge.

## Validação
- Abrir `/chat` → conversas com Julia ativa mostram "J" verde; conversas com humano em atendimento mostram "H" vermelho.
- Ao desativar a Julia (humano envia mensagem) → badge atualiza para "H".

