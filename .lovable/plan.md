# Corrigir a LÍDIA que não carrega as conversas

## O que está acontecendo (confirmado nos logs)

Toda chamada da LÍDIA registra este erro no backend:

```text
[lidia-copilot] agent lookup failed: relation "queue_agent_links" does not exist
```

A função procura o vínculo fila → agente no banco legado (Postgres externo), mas a tabela `queue_agent_links` existe no banco principal (Lovable Cloud), não no legado. Resultado: nenhum agente é encontrado, o card do CRM Julia (que só é buscado quando há agente) nunca entra no contexto, e a LÍDIA responde sem base — ou falha ao montar o contexto da conversa.

Verificado: as mensagens estão íntegras (79 mil nos últimos 7 dias, apenas 9 sem `conversation_id`), então o problema não está no histórico do chat.

## Correção

1. **Buscar o vínculo fila → agente no banco correto**: em `lidia-copilot`, ler `queue_agent_links` (queue_id + is_primary) pelo cliente do banco principal, e só depois usar o `cod_agent` resultante para buscar o prompt/configurações do agente no banco legado.
2. **Fallback de agente**: se a fila não tiver vínculo primário, tentar qualquer vínculo da fila e, por último, o `cod_agent` da própria conversa, antes de assumir "sem agente".
3. **Liberar o CRM Julia sem depender do agente**: passar a buscar o card legado pelo telefone mesmo quando não houver `cod_agent` (filtrando apenas por cliente), para não perder contexto.
4. **Erros visíveis em vez de silenciosos**: quando a busca de agente ou do CRM falhar, devolver essa informação no retorno da função (campo de diagnóstico) e mostrar um aviso discreto no painel da LÍDIA, em vez de apenas um `console.warn` invisível ao atendente.
5. **Validar após o deploy**: chamar a função para uma conversa real da conta do piloto e confirmar nos logs que o agente foi resolvido, que o histórico entrou no prompt e que nenhum erro de tabela inexistente aparece.

## Observação sobre créditos de IA

O bloqueio por créditos de IA já é tratado como estado controlado (sem tela branca). Se o saldo do workspace continuar zerado, a LÍDIA seguirá exibindo o aviso de indisponibilidade mesmo depois desta correção — são problemas independentes.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/lidia-copilot/index.ts`, funções `getAgentForConversation` e `loadContext`.
- `getAgentForConversation` passa a receber o cliente Supabase e fazer o lookup de `queue_agent_links` via Data API; mantém o `postgres.js` externo apenas para `agents` (prompt/settings).
- A consulta de `crm_atendimento_cards` deixa de exigir `cod_agent`; mantém `client_id` + match por últimos dígitos do telefone.
- Frontend: `src/modules/lidia/hooks/useLidia.ts` e `src/modules/lidia/components/LidiaPanel.tsx` para expor o aviso de contexto parcial.
