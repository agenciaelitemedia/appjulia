# JulIA Chat assume o /chat (e o chat atual vai para /chat-old)

O protótipo `/mvp-chat` passa a ser o chat oficial em `/chat`, com pasta renomeada para `julia-chat` e uma cópia própria de todos os componentes de conversa — sem depender mais dos arquivos do chat antigo. O chat atual continua funcionando em `/chat-old` como backup temporário.

## Resultado esperado

- `/chat` = JulIA Chat (lista em query única + conversa real + right-bar).
- `/chat-old` = chat atual intacto, com os arquivos antigos que hoje existem.
- Sub-rotas de configuração seguem nas mesmas URLs (`/chat/canais`, `/chat/metricas`, `/chat/sla`, etc.), mas os **arquivos passam para dentro do JulIA Chat** — deixam de morar na pasta do chat antigo (ver Fase 2b).
- Menu/permissões: o módulo "Chat" continua com o mesmo code e rota `/chat`; nada muda para o usuário em termos de acesso. O item de menu do protótipo (`mvp_chat`, `/mvp-chat`) é removido/desativado.
- `/mvp-chat` continua respondendo por um período, redirecionando para `/chat`.

## Fases

### Fase 1 — Renomear o módulo (mvp-chat → julia-chat)
- `src/modules/mvp-chat/` → `src/modules/julia-chat/`.
- Arquivos e símbolos `Mvp*` → `Julia*` (componentes, hooks, tipos, funções de API), incluindo `MvpChatPage` → `JuliaChatPage`.
- Nomes públicos que NÃO mudam nesta fase (contrato com o backend/banco): a edge function/SQL `mvp_chat_list_feed`, a tabela de cache `mvp_chat_legacy_cache` e as chaves de React Query persistidas. Renomear isso agora criaria risco desnecessário; fica como limpeza posterior.
- Ajustar as duas referências externas: `src/App.tsx` e `src/components/layout/MainLayout.tsx` (regra de largura total).

### Fase 2 — Copiar a árvore de conversa para dentro do módulo
Objetivo: o JulIA Chat não importar mais nada de `src/components/chat/*`, `src/contexts/WhatsAppDataContext.tsx`, `src/lib/chat/*` e hooks exclusivos de chat.

- Nova subpasta `src/modules/julia-chat/chat/` com a cópia do fecho de dependências a partir de: `WhatsAppDataContext`, `ChatHeader`, `ChatMessages`, `ChatInput`, `ChatRightBar`, `NewConversationDialog`, `TransferDialog`, `ReturnToQueueDialog`, `ContactCampaignCard` e tudo que eles importam (bolhas de mensagem, mídia, quoted, reações, tags, prioridade, SLA, resumos, CSAT, snooze, agendamento, gravador de áudio, CRM side panels, `lib/chat/*`, hooks `useChat*` usados por eles).
- Cópia mecânica: conteúdo idêntico, apenas os imports internos reescritos para caminhos do módulo. Sem refatorar comportamento nesta fase.
- Permanecem compartilhados (infra do app, não "arquivos antigos do chat"): `@/components/ui/*`, `AuthContext`, `UaZapiContext`/`WavoipContext`/`PhoneContext`, `@/integrations/supabase/client`, `@/lib/externalDb`, `isOwner`, hooks de permissão/fila (`useUserQueueAccess`, `useChatRolePermissions`), `TeamMemberSelect`, tipos em `src/types/*`.
- `src/modules/julia-chat/extend/*.ts` deixa de reexportar componentes do chat antigo e passa a apontar para as cópias locais; continua reexportando a infra compartilhada acima.
- Os arquivos originais em `src/components/chat/` e `src/contexts/WhatsAppDataContext.tsx` ficam intocados (são o que o `/chat-old` usa).

### Fase 3 — Trocar as rotas
- `/chat` → `JuliaChatPage` (dentro de `ProtectedRoute`, com a mesma regra de acesso que a rota tem hoje).
- `/chat-old` → `ChatPage` atual (`src/pages/chat/ChatPage.tsx`), também protegida.
- `/mvp-chat` → `<Navigate to="/chat" replace />`.
- `MainLayout`: a regra de largura total passa a valer para `/chat` e `/chat-old`.
- Deep links existentes (`setPendingSelection` + navegação para `/chat`, vindos do CRM Builder, Contatos, Tickets e ChatSidePanel) continuam apontando para `/chat`; o JulIA Chat passa a consumir `chat_pending_*` com a mesma lógica que hoje existe no `ChatPage` (aplicar fila → validar acesso → selecionar contato → limpar pendência).

### Fase 4 — Menu e módulo
- Remover o registro/menu do protótipo `mvp_chat` (rota `/mvp-chat`) para não haver dois itens de chat.
- Confirmar que o item "Chat" do menu aponta para `/chat` e que as permissões/visibilidade por perfil continuam idênticas.
- `/chat-old` não recebe item de menu — acesso apenas por URL direta (backup).

### Fase 5 — Validação (antes de considerar pronto)
- Build + typecheck limpos.
- `/chat`: abrir conversa, enviar texto/áudio/mídia, citar, reagir, transferir, assumir, devolver para fila, adiar, resumo, right-bar (Contato/CRM/Lead), nova conversa pelo rodapé, filtros/abas/paginação, tempo real.
- Perfis: dono/admin vs. colaborador/time — ícones da toolbar, filas restritas (`queue_access = specific`), fila desconectada bloqueando envio.
- Deep link do CRM/Contatos/Tickets abrindo a conversa certa em `/chat`.
- `/chat-old` continua funcionando sem regressão.

## Notas técnicas

- A cópia é grande (≈60 componentes + `WhatsAppDataContext` de ~3.1k linhas + hooks e libs de chat). Será feita em lotes por dependência, com build entre lotes, e sem alterar nenhum arquivo do chat antigo — assim qualquer problema fica contido no módulo novo.
- Duplicação é intencional e temporária: enquanto `/chat-old` existir, correções precisam ser aplicadas na cópia do módulo (fonte da verdade) e, se necessário, no antigo. Ao descontinuar o `/chat-old`, apagamos `src/pages/chat/ChatPage.tsx`, `src/components/chat/*` e `WhatsAppDataContext` originais.
- Nada de mudança em banco, RLS, edge functions ou webhooks nesta entrega.
