# Automações Visuais Julia — Editor de Fluxos com React Flow

Construtor visual de automações (estilo n8n) para orquestrar **CHAT**, **CRM** e **Julia (IA)**, substituindo o construtor atual de listas (`/chat/builder`) por um canvas React Flow com arestas animadas, configuração por painel lateral intuitivo, handles de entrada/saída nas laterais dos nós e exclusão de nó com confirmação.

## Escopo funcional

### Nós de disparo (Triggers) — todo fluxo começa por um
- Nova conversa / conversa recebida
- Mensagem recebida do lead (filtro por palavra-chave e tipo de mídia)
- Mudança de status da conversa (pendente, aberta, resolvida, fechada)
- Mudança de fila / atribuição de atendente
- Etiqueta adicionada/removida
- Inatividade do lead (X min sem resposta do lead)
- Inatividade do atendente (X min sem resposta do atendente)
- Card do CRM criado / movido de fase
- Agendado (cron: a cada X min, diário, horário comercial)
- Webhook de entrada (URL própria do fluxo)

### Nós de condição / lógica
- Condição (IF/ELSE): campo, operador, valor — saídas "Verdadeiro"/"Falso"
- Roteador múltiplo (switch com N saídas nomeadas)
- Tipo de conversa / canal (uazapi, WABA, Instagram, WebChat)
- Status da Julia (IA ativa/inativa, followup ativo, etapa do followup)
- Tempo desde a última resposta do lead
- Tempo desde a última resposta do atendente
- Dentro/fora do horário de atendimento
- Fase atual no CRM (CRM Julia legado e CRM Builder)
- Aguardar (delay fixo) e Aguardar resposta do lead (com timeout)

### Nós de ação — Chat
- Enviar mensagem de texto (variáveis `{{nome}}`, `{{protocolo}}`, etc.)
- Enviar imagem, áudio, vídeo, documento, sticker
- Enviar mensagem rápida (biblioteca `quick_messages`)
- Etiquetar / remover etiqueta
- Atribuir a atendente, transferir de fila, encaminhar para humano
- Mudar prioridade, resolver/reabrir/fechar conversa
- Adicionar nota interna
- Gerar resumo da conversa por IA

### Nós de ação — Julia
- Ativar / desativar Julia
- Reativar agente + reincluir no followup
- Parar followup
- Trocar de agente/alias

### Nós de ação — CRM
- Criar card (CRM Builder ou CRM Julia)
- Editar campos do card
- Mover card de fase/pipeline
- Definir responsável / valor / prioridade
- Vincular conversa ao card

### Nós de ação — Integração e dados
- Enviar para webhook (usa `chat_webhooks` ou URL avulsa)
- Requisição HTTP (método, URL, headers, body com variáveis, timeout)
- Guardar dados (define variáveis do fluxo a partir da resposta, ex. `resp.data.id`)
- Notificação interna / push
- Encerrar fluxo (com motivo)

## Experiência do editor

- Canvas React Flow com fundo pontilhado, minimap, controles de zoom e auto-fit
- **Arestas animadas** (smoothstep animado) e destaque do caminho percorrido no modo de teste
- **Handles laterais**: entrada à esquerda, saídas à direita; condição/roteador com múltiplos handles rotulados
- Paleta lateral por categoria (Disparo, Lógica, Chat, Julia, CRM, Dados) com busca e arrastar-e-soltar
- Clique no nó abre painel de configuração à direita com campos visuais (selects de fila, atendente, etiqueta, pipeline/fase, mensagem rápida; sliders de tempo; seleção de mídia; variáveis como chips clicáveis). Sem JSON exposto.
- O nó exibe um resumo legível da própria configuração (ex. "Se lead sem responder > 30 min")
- Validação visual: nó incompleto ganha borda de alerta e impede ativar o fluxo
- **Excluir nó com confirmação** (AlertDialog "Excluir nó?"), pelo ícone de lixeira no hover ou tecla Delete; arestas ligadas são removidas junto
- Duplicar nó, copiar/colar, desfazer/refazer, auto-layout, salvar por atalho, indicador de alterações não salvas
- Modo de teste: escolher uma conversa e simular (sem enviar nada), mostrando caminho e log por nó
- Aba de execuções: histórico com status por nó

## Detalhes técnicos

**Dependências**: `@xyflow/react` (React Flow 12) e `dagre` (auto-layout).

**Dados**: reutiliza `chat_bot_flows` (`nodes`/`edges` JSONB, `trigger_type`, `is_active`, `client_id`) e `chat_bot_flow_runs`. Migração adiciona só o necessário: em `chat_bot_flows` → `variables jsonb`, `trigger_config jsonb`, `version int`; em `chat_bot_flow_runs` → `node_logs jsonb`, `status`, `error_message`. GRANTs e RLS por `client_id` no mesmo padrão do módulo chat.

**Frontend** (novo diretório `src/pages/chat/flow-builder/`):
- `FlowBuilderPage.tsx` — lista de fluxos e criação
- `FlowEditorPage.tsx` — canvas em `/chat/builder/:flowId`
- `components/canvas/` — `FlowCanvas.tsx`, `NodePalette.tsx`, `FlowToolbar.tsx`, `edges/AnimatedEdge.tsx`
- `components/nodes/` — `BaseNode.tsx` (casca com handles laterais, ícone, resumo, menu excluir/duplicar) + variantes por categoria
- `components/inspector/` — `NodeInspector.tsx` e um form por tipo de nó
- `registry/nodeRegistry.ts` — fonte única da verdade: categoria, ícone, cor, handles de saída, schema Zod da config, função de resumo e form de cada nó. Novo nó = uma entrada no registro.
- `hooks/useFlowEditor.ts` — estado do canvas, undo/redo, dirty tracking
- Reaproveita hooks existentes: `useChatBotFlows` (estendido), `useQueueMembers`, tags, `useQuickMessages`, `useCRMBoards`/`useCRMDeals`, webhooks

**Backend** — nova edge function `chat-flow-engine`:
- Entrada `{ event, flow_id?, conversation_id, client_id, payload }`
- Seleciona fluxos ativos por `trigger_type` + condições do trigger, percorre o grafo a partir do `start_node_id`, executa nó a nó com limite de passos e timeout, mantém variáveis do run e grava `chat_bot_flow_runs` com log por nó
- Executores de ação isolados em `_shared/flow-actions/` (chat, julia, crm, http) reutilizando os adapters uazapi/WABA e `db-query`
- Nós de espera (delay, aguardar resposta, inatividade) persistem o run como `waiting`, retomado por `chat-flow-scheduler` (cron) ou pela chegada de mensagem
- Ganchos de disparo em `uazapi-chat-webhook`, webhook WABA e mutations de CRM/conversa, sempre fire-and-forget para não atrasar a ingestão
- `chat-automation-engine` (regras simples atuais) continua funcionando; o novo motor roda em paralelo, sem substituí-lo

## Fases de entrega

1. **Fundação do editor** — dependências, registro de nós, canvas com arestas animadas, handles laterais, paleta, inspetor, salvar/carregar, exclusão com confirmação. Nós iniciais: trigger de mensagem, condição, enviar texto, etiquetar, encaminhar para humano, encerrar.
2. **Executor** — `chat-flow-engine`, logs em `chat_bot_flow_runs`, gancho nos webhooks, modo de teste em simulação.
3. **Tempo e inatividade** — triggers e condições de tempo de resposta do lead/atendente, delay, aguardar resposta, `chat-flow-scheduler` via cron.
4. **CRM e Julia** — criar/editar/mover card, mudar CRM da Julia, ativar/desativar Julia, followup.
5. **Dados e integrações** — webhook, requisição HTTP, guardar dados/variáveis, notificações.
6. **Mídia e acabamento** — enviar imagem/áudio/vídeo/documento/sticker, auto-layout, undo/redo, aba de execuções, permissões do módulo e migração dos fluxos antigos.