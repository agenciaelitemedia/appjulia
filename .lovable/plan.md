# Restaurar a barra lateral direita do Chat

## Diagnóstico confirmado

- A coluna fixa continua implementada no `ChatContainer` e só é renderizada quando existe um contato selecionado e `showDetailPanel` está ativo.
- O build atual está OK e não há erro de execução relacionado à `ChatRightBar`.
- O estado de abertura ainda lê `chat_rightbar_open_v2` do navegador. Quando essa chave está gravada como `false`, a coluna não é montada, mesmo no desktop — por isso a alteração da aba Lead pode estar correta e a barra inteira continuar ausente.

## Correção

1. Migrar a preferência de abertura para uma nova versão, descartando uma vez o valor fechado legado que está ocultando a barra.
2. Restaurar o padrão aberto no desktop (`>= 1024px`) quando a preferência nova ainda não existir; no mobile, continuar fechado por padrão e abrir como Sheet.
3. Manter o botão de fechar funcional e persistir novas escolhas do usuário após a migração.
4. Preservar as três abas atuais — Contato, CRM e Lead — sem alterar consultas, dados ou ações.
5. Validar no Chat que, ao selecionar uma conversa no desktop, a coluna fixa aparece sem overlay e que fechar/reabrir continua funcionando.

## Arquivos envolvidos

- `src/contexts/WhatsAppDataContext.tsx`: migração e inicialização da preferência de abertura.
- `src/components/chat/ChatContainer.tsx`: somente se necessário para reforçar a abertura ao selecionar uma conversa no desktop; nenhuma mudança de layout.
