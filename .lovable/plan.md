## Objetivo
Mudar quando a Julia (sessão IA + followup) é parada: **remover** o disparo atual no envio manual de mensagem/mídia e disparar **somente** quando o atendente:
1. Clica em "Assumir" (botão do header ou do menu de ações rápidas ou do banner de claim no input).
2. Transfere a conversa manualmente para outro atendente (TransferDialog).

Não disparar em transferências automáticas (regras de routing server-side, que não passam por `assignConversation`).

## Mudanças

### 1. `src/contexts/WhatsAppDataContext.tsx`
- **Remover** as duas chamadas atuais de `disableJuliaForManualUserSend` em `sendMessage` (linha ~1650) e `sendMedia` (linha ~2020).
- **Manter** a função helper, mas renomear conceitualmente para `disableJuliaOnAssignOrTransfer` (mesma lógica de resolver `cod_agent` + desativar sessão).
- **Adicionar** chamada à edge `n8n_execute-followup-stop` dentro desse helper (fire-and-forget, best-effort, idêntico ao que o helper edge `disableJuliaOnHumanSend` já faz). Assim o frontend para sessão Julia + followups numa só chamada.
- **Chamar o helper dentro de `assignConversation`**, logo após o UPDATE em `chat_conversations` ter sucesso. Argumentos:
  - `contactPhone`: buscar via `chat_conversations.contact_id → chat_contacts.phone` (ou usar contato já em memória via `contacts.find`).
  - `queueId`: pegar de `chat_conversations.channel_source` da conversa (ou do `contacts.channel_source`).
  - `userId`: usuário autenticado atual (apenas para confirmar que é ação humana — se não houver `user.id`, abortar).
- Como `assignConversation` é chamada para ambos os casos (assumir e transferir), uma única injeção cobre os dois requisitos.

### 2. Comportamento preservado / fora do escopo
- Webhooks e edge functions de mensagens (`uazapi-chat-webhook`, `waba-send`, `meta-webhook`) continuam **sem** parar Julia.
- Regras de routing automáticas que atualizam `assigned_to` direto no banco (sem passar pelo frontend `assignConversation`) **não** disparam followup-stop — atende ao requisito.
- `handleReopen` no `ChatInput` chama `assignConversation` ao reabrir — como é uma ação manual do atendente, será coberta automaticamente (efeito colateral aceitável; se quiser excluir, sinalize).
- Edge helper `supabase/functions/_shared/disableJuliaOnHumanSend.ts` permanece como está (ainda não é chamado por ninguém; mantemos para uso futuro em edge functions).

### 3. Atualizar memória
- `mem/features/ai-agent/human-override-logic.md`: substituir a regra "envio manual de texto/mídia desativa Julia" pela nova regra "Assumir / Transferir manual desativa Julia + dispara `n8n_execute-followup-stop`".

## Arquivos
- editar: `src/contexts/WhatsAppDataContext.tsx`
- editar: `mem/features/ai-agent/human-override-logic.md`

Nenhuma mudança em edge functions, config.toml ou backend.

## Pontos a confirmar
1. **`handleReopen`** (reabrir conversa fechada) também chama `assignConversation` — deve disparar followup-stop também? Padrão proposto: **sim**, pois é ação manual do atendente.
2. Em transferência **para outro atendente**: a Julia deve ser parada mesmo se o `assigned_to` está mudando de Agente A para Agente B (sem envolver Julia)? Padrão proposto: **sim**, qualquer assign manual dispara.