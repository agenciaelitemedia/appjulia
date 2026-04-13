

## Plano: Agent Select + Chat Inline no Atendimento Humano

### Problema Atual

1. Não existe seletor de agente — carrega todos os agentes do usuário automaticamente
2. O chat usa `WhatsAppMessagesDialog` com `variant="sheet"`, que abre como overlay (Sheet do Radix) em vez de renderizar inline ao lado da lista

### Mudanças

#### 1. Adicionar `variant="inline"` ao `WhatsAppMessagesDialog`

No componente `WhatsAppMessagesDialog.tsx`, adicionar suporte a um terceiro variant `'inline'`. Quando `variant === 'inline'`:
- Não usar wrapper `Sheet`/`Dialog` — renderizar diretamente um `div` com `flex flex-col h-full`
- Remover o portal/overlay — o conteúdo fica inline no DOM pai
- Manter 100% da lógica interna: header (nome editável, bot switch, contrato), mensagens, input (texto, áudio, mídia, notas, mensagens rápidas)

Alteração localizada: nas linhas ~1665-1684, adicionar condição para `inline` que renderiza sem wrapper.

#### 2. Adicionar `AgentSearchSelect` ao header do `HumanSupportPage`

- Importar `AgentSearchSelect` e `useJuliaAgents` (já existentes)
- Adicionar state `selectedAgent` no hook `useInactiveLeads` (ou na page)
- Filtrar leads pelo `cod_agent` selecionado
- Posicionar o select no header acima da lista de leads
- Quando nenhum agente selecionado, mostrar leads de todos os agentes do usuário

#### 3. Atualizar `HumanSupportPage` para usar variant inline

Trocar `variant="sheet"` por `variant="inline"`, eliminando o comportamento de overlay. O chat renderiza diretamente no `div.flex-1` ao lado da lista.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adicionar `variant="inline"` — renderizar sem Sheet/Dialog wrapper |
| `src/pages/atendimento-humano/HumanSupportPage.tsx` | Usar `variant="inline"`, adicionar `AgentSearchSelect` no header |
| `src/pages/atendimento-humano/hooks/useInactiveLeads.ts` | Aceitar filtro por `selectedAgentCode` opcional |
| `src/pages/atendimento-humano/components/InactiveLeadsList.tsx` | Adicionar slot para o agent select no header |

