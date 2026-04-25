## Objetivo
Reorganizar a barra de ícones do `/chat` (`ChatList.tsx`):
1. Mover o ícone de **Métricas** (BarChart3) para ficar **ao lado do ícone de Filtro** (próximo à barra de busca).
2. Criar um novo ícone de **Configurações do Chat** (`Settings`) — visível **apenas para o dono da conta** (`role === 'user'` ou `isAdmin`).
3. Esse ícone abre um Dialog com 3 abas: **Geral / SLA / Etiquetas**.
4. **Remover** os ícones individuais de SLA (Timer) e Etiquetas (Tag) da barra superior — seu conteúdo vai para as abas.

---

## Passo 1 — Criar `ChatSettingsDialog.tsx`
Novo arquivo `src/components/chat/ChatSettingsDialog.tsx`:
- `Dialog` largo (`sm:max-w-3xl`) com `Tabs` (shadcn) e 3 abas: **Geral**, **SLA**, **Etiquetas**.
- **Aba Geral**: placeholder simples ("Configurações gerais do chat em breve") — pode listar atalhos/preferências básicas existentes.
- **Aba SLA**: importar e renderizar inline o conteúdo da página `ChatSlaConfigPage` (ou extrair seu corpo principal para um componente reutilizável `ChatSlaConfigContent`). Como é dialog, usar `max-h-[70vh] overflow-y-auto`.
- **Aba Etiquetas**: reutilizar o conteúdo já presente em `TagsManagerDialog` — extrair o corpo (lista + criação) para um `TagsManagerContent` interno (ou apenas renderizar o `TagsManagerDialog` como conteúdo embutido removendo o wrapper Dialog).

## Passo 2 — Atualizar `ChatList.tsx`
- Importar `Settings` do lucide-react e `ChatSettingsDialog`.
- Importar `useAuth` (já usado na lib) para obter `user.role` / `isAdmin`.
- Definir `canManageChat = isAdmin || user?.role === 'user'`.
- **Remover** da barra superior (linhas ~354-359):
  - Botão SLA (`Timer`, navigate `/chat/sla`).
  - Botão Tags (`Tag`, abre `TagsManagerDialog`).
- **Remover** o botão de Métricas (linhas 341-343) da barra superior.
- **Adicionar**, **ao lado do botão de Filtro** (dentro do `div` da search bar, antes do botão Filter), o botão de **Métricas** (`BarChart3`, navigate `/chat/metricas`).
- **Adicionar**, também ao lado do Filtro, o botão de **Configurações do Chat** (`Settings`) — somente se `canManageChat` — que faz `setShowChatSettings(true)`.
- Manter os botões admin (Automações/Canais) na barra superior.
- Renderizar `<ChatSettingsDialog open={showChatSettings} onOpenChange={setShowChatSettings} />`.
- Remover o `<TagsManagerDialog>` standalone daqui (passa a ser usado dentro do dialog de configurações).

## Passo 3 — Refatorar `TagsManagerDialog`
Extrair o corpo (lista de tags + form de criação) para um componente `TagsManagerContent` exportado, mantendo o `TagsManagerDialog` como wrapper que usa esse content. Isso permite reuso na aba Etiquetas sem duplicar Dialog dentro de Dialog.

A regra de permissão de criação/edição já implementada (`canManage = isAdmin || role === 'user'`) permanece dentro do conteúdo.

## Passo 4 — Reaproveitar SLA Config
Inspecionar `src/pages/chat/ChatSlaConfigPage.tsx` e extrair o corpo principal para `ChatSlaConfigContent` (mesmo padrão). A página continua existindo e renderiza o `Content`. A aba SLA do dialog usa o `Content` diretamente.

## Passo 5 — Atualizar `src/components/chat/index.ts`
- Exportar `ChatSettingsDialog`.

---

## Arquivos afetados
- **Criar**: `src/components/chat/ChatSettingsDialog.tsx`
- **Editar**: `src/components/chat/ChatList.tsx`
- **Editar**: `src/components/chat/TagsManagerDialog.tsx` (extrair `TagsManagerContent`)
- **Editar**: `src/pages/chat/ChatSlaConfigPage.tsx` (extrair `ChatSlaConfigContent`)
- **Editar**: `src/components/chat/index.ts`

## Resultado
- Barra superior: apenas botões admin (Automações, Canais).
- Linha da busca: `[input busca] [Métricas] [Filtro] [Configurações (somente dono)]`.
- Configurações abre Dialog com abas Geral/SLA/Etiquetas, restrito a `role === 'user'` (dono) ou admin.