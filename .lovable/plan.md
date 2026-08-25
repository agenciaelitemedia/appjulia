# Ajuste de label: Observadores → Observações

## Contexto
Na aba **Contato** da right-bar do chat (tanto no `/chat` antigo quanto no novo `/chat` JulIA), a seção que lista os participantes/observers da conversa está com o título **"Observadores"**. O usuário solicitou que essa seção volte a ser chamada **"Observações"**, como estava anteriormente.

## O que será alterado
- Renomear o título da seção de **"Observadores"** para **"Observações"**.
- Renomear o estado vazio de **"Sem observadores"** para **"Sem observações"**.
- Manter a funcionalidade existente de adicionar/remover participantes da conversa inalterada.

## Arquivos
- `src/components/chat/ConversationParticipants.tsx`
- `src/modules/julia-chat/chat/components/ConversationParticipants.tsx`

## Mudanças técnicas
```text
Título da seção:
  "Observadores" → "Observações"

Texto de lista vazia:
  "Sem observadores" → "Sem observações"

Toasts/mensagens (opcional, se fizer sentido manter termo de pessoa):
  manter "observador" nos toasts de adicionar/remover, pois a ação ainda é sobre pessoas.
```

## Validação
- Verificar visualmente no preview se a seção aparece como **"Observações"**.
- Confirmar que adicionar/remover participantes continua funcionando.
