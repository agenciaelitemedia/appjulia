# Botão "Gerar Resumo" na barra da conversa

## Objetivo
Permitir que o atendente gere o resumo do atendimento direto na barra superior da conversa, sem precisar abrir Detalhes > Resumos.

## O que será feito
- Adicionar um botão de ícone "Gerar resumo" na barra de ações do header da conversa, no mesmo grupo dos botões Detalhes/Soneca (ícone Sparkles, tooltip "Gerar resumo do atendimento").
- Adicionar o mesmo botão (apenas ícone) na barra de envio de mensagem, ao lado do ícone de notas internas.
- Ao clicar: gera o resumo da conversa atual usando exatamente a mesma lógica já existente da aba de resumos (hook `useConversationSummaries`, continuando a partir do último resumo).
- Estados: spinner enquanto gera, botão desabilitado sem conversa selecionada ou durante a geração, toast de sucesso/erro.
- O resumo gerado aparece dentro da própria conversa, na linha do tempo, usando o mesmo card colapsável da aba de resumos (prévia curta, clique para expandir com período, sentimento, resumo e atendimento). Aparece na posição cronológica pela data de criação do resumo.
- Todos os resumos daquele contato/conversa aparecem na conversa, não só o recém-gerado, e o card novo surge automaticamente após gerar (o realtime da tabela de resumos já atualiza).
- A aba de resumos e o resumo automático continuam iguais.

## Detalhes técnicos
- `src/components/chat/ChatHeader.tsx`: importar `useConversationSummaries`, chamar com `selectedConversation?.id` e `contact.id`, e usar `generateSummary(convId, contact.id, getAfterTsForNext(), 'manual')`.
- `src/components/chat/ChatInput.tsx`: usar o mesmo hook com `selectedConversation?.id` e `contactId`; botão `variant="ghost" size="icon"` de `h-9 w-9` ao lado do dropdown de nota interna, com `Sparkles` (ou `Loader2` girando durante a geração).
- `src/components/chat/ConversationSummaries.tsx`: extrair o card em um componente reutilizável `SummaryCard` (mesmo visual), consumido tanto pela aba quanto pela linha do tempo.
- `src/components/chat/ChatMessages.tsx`: adicionar um terceiro tipo `summary` ao `TimelineItem`, alimentado por `useConversationSummaries` (por `contact_id`), incluído no merge cronológico por `created_at` e renderizado com `SummaryCard` centralizado (largura limitada, estilo de bloco de sistema).
- Botão visível apenas quando existe `selectedConversation` e `readOnly === false` (mesma condição do grupo de ações atual).
- Nenhuma mudança de banco, edge function ou hook.