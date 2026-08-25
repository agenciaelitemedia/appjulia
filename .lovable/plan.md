# Restaurar Observações na aba Contato

## Objetivo
Na aba **Contato** da right-bar, a área onde hoje aparece **Observadores** deve voltar a ser a área de **Observações**, permitindo registrar e visualizar observações/notas internas da conversa.

## Correção planejada
- Remover a seção de **Observadores** desse ponto da aba Contato.
- Recolocar a seção **Observações** no mesmo lugar visual, logo abaixo de **Tags** e antes de **Informações da Conversa**.
- Listar as observações já salvas da conversa usando as notas internas existentes (`chat_messages` com `internal_note = true` e `conversation_id` da conversa ativa).
- Adicionar um campo discreto para criar nova observação diretamente nessa seção.
- Salvar a nova observação usando a funcionalidade já existente de nota interna (`sendInternalNote`), para não criar outro fluxo de dados nem quebrar o histórico atual.
- Manter as observações também aparecendo no histórico/mensagens como notas internas, como já funciona hoje.

## Escopo
- Aplicar no chat principal JulIA.
- Aplicar também no componente espelhado do chat legado, para manter consistência onde ele ainda for usado.
- Não alterar permissões, banco de dados, estrutura de mensagens, tags, telefonia ou CRM.
- Não remover a funcionalidade técnica de participantes/observadores caso ela seja usada em outro lugar; apenas não exibir essa seção como se fosse “Observações” na aba Contato.

## Arquivos previstos
- `src/modules/julia-chat/chat/components/ContactDetailPanel.tsx`
- `src/components/chat/ContactDetailPanel.tsx`
- Possível novo componente pequeno reutilizável de observações, se ficar mais limpo do que duplicar a UI nos dois painéis.

## Detalhes técnicos
```text
Fonte das observações:
  chat_messages
  WHERE conversation_id = selectedConversation.id
    AND internal_note = true

Criação de observação:
  sendInternalNote(contact.id, texto, usuário atual, { noteType: 'info' })

Layout na aba Contato:
  Tags
  Separador
  Observações
  Separador
  Informações da Conversa
```

## Validação
- Abrir detalhes de um contato no `/chat`.
- Confirmar que aparece **Observações**, não **Observadores**.
- Criar uma observação e confirmar que ela permanece ao fechar/reabrir a conversa.
- Confirmar que Tags e Informações da Conversa continuam no mesmo padrão visual.
