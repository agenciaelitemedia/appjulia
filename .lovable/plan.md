# Botão "Gerar Resumo" na barra da conversa

## Objetivo
Permitir que o atendente gere o resumo do atendimento direto na barra superior da conversa, sem precisar abrir Detalhes > Resumos.

## O que será feito
- Adicionar um botão de ícone "Gerar resumo" na barra de ações do header da conversa, no mesmo grupo dos botões Detalhes/Soneca (ícone Sparkles, tooltip "Gerar resumo do atendimento").
- Ao clicar: gera o resumo da conversa atual usando exatamente a mesma lógica já existente da aba de resumos (hook `useConversationSummaries`, continuando a partir do último resumo).
- Estados: spinner enquanto gera, botão desabilitado sem conversa selecionada ou durante a geração, toast de sucesso/erro.
- Após gerar com sucesso, abre o painel de detalhes para o atendente ler o resumo (reaproveita o `onShowDetails` já existente).
- A aba de resumos e o resumo automático continuam iguais.

## Detalhes técnicos
- `src/components/chat/ChatHeader.tsx`: importar `useConversationSummaries`, chamar com `selectedConversation?.id` e `contact.id`, e usar `generateSummary(convId, contact.id, getAfterTsForNext(), 'manual')`.
- Botão visível apenas quando existe `selectedConversation` e `readOnly === false` (mesma condição do grupo de ações atual).
- Nenhuma mudança de banco, edge function ou hook.