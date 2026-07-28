## Objetivo

Permitir que um usuário **sem** permissão nos módulos `chat_admin` e `crm_leads` (CRM da Jul.IA) consiga, dentro de um card do **CRM Builder** onde tenha permissão:

- Ver **todas** as informações do card, inclusive dados vindos do CRM da Jul.IA (stage, business_name, contrato, etc.) — normalmente.
- Abrir o **painel lateral de chat** do card e **ler** a conversa vinculada.
- **NÃO** poder assumir a conversa nem enviar mensagens/áudio/anexos, a menos que também tenha o módulo `chat_admin`.

Ou seja: no CRM Builder, o acesso a dados de outros módulos passa a ser controlado pelas permissões do próprio quadro (Builder). Os módulos `chat_admin` e `crm_leads` só passam a ser exigidos para **ações de escrita no chat** (assumir + enviar).

## Estado atual (verificado)

- `BoardChatSidePanel` (Builder) e `ChatSidePanel` (`src/components/chat/ChatSidePanel.tsx`) já são reusáveis; hoje renderizam `ChatHeader` + `ChatMessages` + `ChatInput` sem checar `chat_admin`.
- `useDealJuliaContext` / `DealCard` carregam dados do CRM Jul.IA sem gate por `crm_leads` — leitura já funciona.
- Ações no header (assumir, transferir, resolver…) vivem em `ChatHeader.tsx`; envio em `ChatInput.tsx`. Ambos usam o `WhatsAppDataProvider` isolado do painel.
- Permissão de chat = `hasPermission('chat_admin', 'view' | 'create' | 'edit')` via `useAuth()`.

## Escopo da mudança

Somente frontend / apresentação. Nada de RLS ou edge functions. As permissões no CRM Builder (`crm_board_permissions` + owner/admin) continuam sendo a fonte da verdade para ver/editar o card.

### 1. `ChatSidePanel` ganha modo read-only

Adicionar prop `readOnly?: boolean` em `ChatSidePanelProps`. Quando `true`:
- Passar `readOnly` para `ChatHeader` e `ChatInput` (nova prop).
- No lugar do `ChatInput`, renderizar uma faixa informativa: *"Você está visualizando esta conversa a partir do CRM. Para responder, é necessário permissão no módulo Chat."*
- Manter `ChatMessages` totalmente funcional (leitura).
- Manter o botão "Abrir no Chat" (`ExternalLink`): se o usuário não tiver `chat_admin`, ao clicar mostrar toast informativo em vez de navegar — ou simplesmente ocultar o botão. **Decisão:** ocultar (evita frustração).

### 2. `ChatHeader` em modo read-only

Adicionar prop `readOnly?: boolean`. Quando `true`, ocultar/desabilitar:
- Botão **Assumir** / **Transferir** / **Encerrar** / **Resolver** / **Reabrir**.
- Toggle da Jul.IA (ativar/desativar sessão).
- Ações de ticket que exigem `create/edit`.

Manter visíveis (leitura pura): nome/avatar do contato, badges de fila/status, botão fechar painel, "ver detalhes".

### 3. `ChatInput` em modo read-only

Aceitar prop `readOnly?: boolean` — quando `true`, retornar `null` (o painel já mostra a faixa informativa acima). Alternativa: renderizar textarea desabilitado com placeholder "Sem permissão para responder". **Decisão:** retornar `null` + faixa informativa no painel para evitar UI enganosa.

### 4. Wiring nos consumidores

`BoardChatSidePanel` (CRM Builder) computa:

```ts
const { hasPermission } = useAuth();
const canWriteChat = hasPermission('chat_admin', 'edit') || hasPermission('chat_admin', 'create');
```

E passa `readOnly={!canWriteChat}` para `ChatSidePanel`.

Outros consumidores do `ChatSidePanel` (CRM Jul.IA, Contratos) permanecem inalterados — não passam `readOnly` → comportamento atual (escrita liberada, gate original por rota/módulo).

### 5. Dados do CRM Jul.IA no card (leitura)

`useDealJuliaContext`, `useJuliaCardPreview` e blocos correspondentes em `DealCard` já rodam sem gate por `crm_leads`. **Verificar** e garantir que continuam assim (nenhum guard novo por `crm_leads` deve ser adicionado). Nada a mudar aqui — apenas confirmar durante a implementação.

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/components/chat/ChatSidePanel.tsx` | Adicionar prop `readOnly`; ocultar `ExternalLink` e trocar `ChatInput` por faixa informativa quando true. |
| `src/components/chat/ChatHeader.tsx` | Adicionar prop `readOnly`; esconder Assumir/Transferir/Resolver/Reabrir/toggle Jul.IA. |
| `src/components/chat/ChatInput.tsx` | Adicionar prop `readOnly` (retorna `null`). |
| `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` | Calcular `canWriteChat` via `useAuth().hasPermission('chat_admin', ...)` e propagar `readOnly`. |

## Fora do escopo

- Rota `/chat` continua exigindo `chat_admin` no `ProtectedRoute` (usuários sem o módulo simplesmente não vão para lá).
- RLS / edge functions: sem mudanças. Leitura das mensagens já é permitida pela RLS atual do chat (ver contexto de segurança do projeto).
- Rota `/crm/leads` (Jul.IA CRM) segue exigindo `crm_leads`. A liberação é só para os **dados exibidos dentro do card do Builder**.

## Riscos

- `ChatHeader` é usado também em `/chat` (não só no painel lateral). A prop `readOnly` precisa ter default `false` para não afetar o fluxo principal. Mesmo cuidado com `ChatInput`.
- Verificar visualmente após a mudança que a UI do painel em modo read-only fica coerente (sem espaços vazios ou botões órfãos).
