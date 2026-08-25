# Right-bar única para CRM Builder e /chat

## Estado atual (verificado no código)

- Ao clicar em detalhes de um card no CRM Builder, o `BoardPage` já abre a `DealRightBarSheet`, que renderiza a mesma right-bar do chat (`ChatRightBar`) com as abas **Contato / CRM / Telefonia** e a aba **CRM** ativa por padrão.
- A aba **Contato** já segue a ordem pedida: **Tags → Observações → Informações da Conversa** (título já renomeado de "Conversa Atual"), tanto no `/chat` (JulIA) quanto no painel espelhado legado.

## O que falta

- Quando o card do CRM não tem contato/conversa do chat vinculados, o clique em detalhes cai no antigo `DealDetailsSheet` (layout diferente, sem as abas). Nesse caso a experiência não é igual à do `/chat`.

## Proposta

- Sempre abrir a right-bar padrão (abas Contato / CRM / Telefonia, aba CRM ativa), mesmo sem contato vinculado.
- Sem contato vinculado:
  - Aba **Contato**: mostrar nome/telefone do próprio card e um aviso curto de que não há conversa vinculada; ocultar Tags/Observações/Informações da Conversa (dependem da conversa).
  - Aba **Telefonia**: manter o histórico por telefone do card quando houver telefone; senão, estado vazio.
  - Aba **CRM**: o conteúdo atual do card (já reaproveitado do `DealDetailsSheet` em modo inline).
- Nenhuma mudança em banco, permissões, CRM ou telefonia — apenas composição de UI.

## Arquivos previstos

- `src/pages/crm-builder/components/deals/DealRightBarSheet.tsx` (remover o fallback e montar a right-bar com dados do card)
- `src/modules/julia-chat/chat/components/ChatRightBar.tsx` e `ContactDetailPanel.tsx` (tolerar contato sem conversa, se necessário)

## Validação

- Card com conversa vinculada: abre com aba CRM ativa; aba Contato mostra Tags, Observações e Informações da Conversa.
- Card sem conversa vinculada: abre com as mesmas 3 abas e estados vazios claros, sem erro.
- `/chat`: aba Contato mantém a ordem Tags → Observações → Informações da Conversa.
