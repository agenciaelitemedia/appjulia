# Botão "Gerar Resumo" na barra da conversa

## Objetivo
Permitir que o atendente gere o resumo do atendimento direto na barra superior da conversa, sem precisar abrir Detalhes > Resumos.

## O que será feito
- Adicionar um botão de ícone "Gerar resumo" na barra de ações do header da conversa, no mesmo grupo dos botões Detalhes/Soneca (ícone Sparkles, tooltip "Gerar resumo do atendimento").
- Adicionar o mesmo botão (apenas ícone) na barra de envio de mensagem, ao lado do ícone de notas internas.
- Ao clicar: gera o resumo da conversa atual usando exatamente a mesma lógica já existente da aba de resumos (hook `useConversationSummaries`, continuando a partir do último resumo).
- Estados: spinner enquanto gera, botão desabilitado sem conversa selecionada ou durante a geração, toast de sucesso/erro.
- No header, após gerar com sucesso, abre o painel de detalhes para o atendente ler o resumo (reaproveita o `onShowDetails` já existente). Na barra de envio, apenas o toast confirma (o resumo aparece na aba de resumos).
- A aba de resumos e o resumo automático continuam iguais.

## Detalhes técnicos
- `src/components/chat/ChatHeader.tsx`: importar `useConversationSummaries`, chamar com `selectedConversation?.id` e `contact.id`, e usar `generateSummary(convId, contact.id, getAfterTsForNext(), 'manual')`.
- `src/components/chat/ChatInput.tsx`: usar o mesmo hook com `selectedConversation?.id` e `contactId`; botão `variant="ghost" size="icon"` de `h-9 w-9` ao lado do dropdown de nota interna, com `Sparkles` (ou `Loader2` girando durante a geração).
- Botão visível apenas quando existe `selectedConversation` e `readOnly === false` (mesma condição do grupo de ações atual).
- Nenhuma mudança de banco, edge function ou hook.