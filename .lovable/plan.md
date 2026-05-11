## Objetivo
Restaurar a exibição correta da etapa da Julia em todas as conversas vinculadas, eliminando os falsos casos de “Sem etapa”.

## O que foi diagnosticado
- O chat agora busca a etapa por `telefone + cod_agent`.
- Nas conversas do chat, o campo `chat_conversations.cod_agent` está vazio no caso analisado.
- Sem esse `cod_agent` real, a lista faz fallback para o agente primário da fila (`queue_agent_links`).
- No exemplo informado (`5584996154035`), a fila `MKT São Paulo` aponta para `202604004`, mas o CRM externo não possui card desse telefone nesse agente.
- Isso indica uma regressão de origem do vínculo: a conversa continua “Julia”, mas a etapa está sendo buscada com o agente errado.

## Plano
1. Revisar a origem do `cod_agent` usado no chat para etapa Julia e parar de depender apenas do agente primário da fila quando a conversa não trouxer esse dado.
2. Implementar uma resolução mais confiável do agente da conversa Julia, priorizando vínculo explícito da própria conversa/contato quando existir, e só usando a fila como último fallback.
3. Ajustar `ChatList` e `ContactDetailPanel` para consumirem a mesma fonte consolidada de `cod_agent`, garantindo consistência entre lista, badge e painel lateral.
4. Tornar o lookup de etapa resiliente a cards já existentes no CRM para o telefone, evitando regressão visual quando o chat estiver sem `cod_agent` persistido.
5. Validar com o caso real informado e com outros contatos Julia para confirmar que “Sem etapa” só desaparece quando o vínculo do card é resolvido corretamente.

## Arquivos prováveis
- `src/components/chat/ChatList.tsx`
- `src/components/chat/ContactDetailPanel.tsx`
- `src/hooks/useCRMStageByPhone.ts`
- possivelmente um util/hook novo para resolver `cod_agent` efetivo da conversa Julia

## Detalhes técnicos
- Unificar a regra de resolução do agente Julia em um único ponto.
- Ordem de prioridade prevista:
  1. `chat_conversations.cod_agent`
  2. vínculo persistido relacionado à conversa/contato, se existir
  3. agente derivado da fila
- Se a conversa estiver vinculada à Julia mas sem `cod_agent` local, a UI não deve assumir silenciosamente que o agente da fila é sempre o do card.
- O caso `5584996154035` será usado como teste de regressão durante a implementação.

## Resultado esperado
- Conversas vinculadas à Julia voltarão a mostrar a etapa correta como antes.
- O badge da etapa ficará coerente entre lista e painel de detalhes.
- O sistema deixará de exibir “Sem etapa” por erro de resolução de agente.