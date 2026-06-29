## Mudanças em /contatos e chat

### 1. Exportar contatos para Excel (`/contatos`)
- Adicionar botão "Exportar Excel" no header de `ContatosPage.tsx`, ao lado do campo de busca.
- Usar a lib `xlsx` (já comum no projeto; instalar se necessário) para gerar `.xlsx` com colunas: **Nome**, **Telefone**, **Fila**, **Data de cadastro**.
- Exportar respeitando a aba ativa (Contatos ou Grupos) e o filtro de busca atual.
- Nome do arquivo: `contatos_YYYY-MM-DD.xlsx` (ou `grupos_…`).

### 2. Mostrar nome da fila em vez do ID
- Hoje `ContactsTable.tsx` renderiza `c.channel_source` na coluna "Fila", e o hook retorna provavelmente o `queue_id`.
- Ajustar `useContactsList.ts` para fazer join/lookup em `queues` (id → name) e retornar `queue_name`.
- `ContactsTable` passa a exibir `queue_name`; o mesmo valor vai para o export.

### 3. Foto em modal (lightbox) com download
- Reaproveitar o componente existente `src/components/chat/MediaLightbox.tsx` (já suporta imagem + botão de download).
- **Em `/contatos`**: tornar o `Avatar` da tabela clicável; ao clicar, abrir `MediaLightbox` com o `avatar` do contato. Quando não houver `avatar`, manter comportamento atual (sem ação).
- **No header do chat**: localizar `ChatHeader.tsx` (foto do contato) e tornar o avatar clicável, abrindo o mesmo `MediaLightbox` com a URL da foto. Nome do arquivo de download = nome do contato.

### Arquivos afetados
- `src/pages/contatos/ContatosPage.tsx` — botão export + handler.
- `src/pages/contatos/components/ContactsTable.tsx` — avatar clicável, coluna passa a usar `queue_name`.
- `src/pages/contatos/hooks/useContactsList.ts` — resolver nome da fila.
- `src/components/chat/ChatHeader.tsx` — avatar clicável → `MediaLightbox`.
- (Reuso) `src/components/chat/MediaLightbox.tsx` — sem alteração.

### Observações
- Não altero lógica de negócio do chat nem do listador além do necessário para exibir o nome da fila.
- Se `xlsx` ainda não estiver instalado no projeto, será adicionado via `bun add xlsx`.
