# Central de Ajuda — estilo Netflix

Módulo completo de ajuda com conteúdo global da plataforma, dividido em **Studio (admin)** para criar/gerenciar conteúdo e **Central de Ajuda (visualização)** com experiência estilo Netflix.

## 1. Banco de dados (novas tabelas)

- **`help_categories`** (sessões/categorias): nome, descrição, ícone, cor, posição, ativa.
- **`help_posts`**: título, slug, resumo, conteúdo rico (JSON do editor), imagem de capa, categoria, status (rascunho/publicado), destaque manual (`is_featured` + `featured_order`), tags, contador de visualizações, autor, datas.
- **`help_post_views`** (leve): registro de visualização por usuário para alimentar "Mais vistos" e "Continue lendo".
- Realtime não é necessário; GRANTs + RLS seguindo o padrão das tabelas existentes.
- **Novo bucket de storage `help-media`** (público) para imagens e vídeos enviados.

## 2. Permissões e menu

- Novo módulo **`help_center`** registrado no sistema de módulos (menu grupo SISTEMA, ícone próprio adicionado ao iconMap):
  - **Ver** → acessa a Central de Ajuda (parte Netflix).
  - **Criar/Editar/Excluir** → acessa o Studio (gestão de categorias e posts). Admin sempre tem tudo.
- Rotas: `/ajuda` (visualização) e `/ajuda/studio` (admin), ambas com `ProtectedRoute`.

## 3. Studio (parte administrativa)

- Abas: **Posts | Categorias | Destaques**.
- **Categorias**: CRUD com nome, ícone, cor e ordenação por arrastar.
- **Posts**: lista com busca/filtro por categoria e status + editor em página cheia:
  - **Editor rico estilo Word (Tiptap)**: negrito, itálico, sublinhado, títulos H1–H3, listas, citação, alinhamento, links, cores, tabelas simples.
  - **Imagens**: upload direto para o storage (arrastar/colar) inseridas no texto + imagem de capa do post.
  - **Vídeos**: botão para embedar YouTube (cola o link) **ou** fazer upload de arquivo de vídeo para o storage (player nativo no post).
  - Pré-visualização, salvar rascunho e publicar.
- **Destaques**: marcar posts como destaque do hero e ordenar.
- Exclusões com dupla confirmação (padrão do sistema).

## 4. Central de Ajuda (estilo Netflix)

- **Hero/banner rotativo** com os destaques manuais (capa grande, título, resumo, botão "Ler agora").
- **Trilhas horizontais (carrosséis)** com cards de capa:
  - Uma trilha por categoria.
  - Trilhas automáticas: **"Adicionados recentemente"** e **"Mais vistos"**.
  - **"Continue lendo"** com posts que o usuário abriu.
- **Busca global** por título/conteúdo/tags.
- **Página do post**: leitura limpa e elegante (tipografia caprichada, imagens e vídeos renderizados), navegação para posts relacionados da mesma categoria, contador de visualização incrementado ao abrir.
- Visual dark e imersivo na central, responsivo, com animações suaves nos carrosséis.

## Detalhes técnicos

- Instalar `@tiptap/react`, `@tiptap/starter-kit` + extensões (image, youtube, link, text-align, color, table); renderização do conteúdo no viewer com o mesmo schema (read-only).
- Upload segue o padrão existente (`supabase.storage.upload` → `getPublicUrl`), bucket `help-media` com políticas no `storage.objects`.
- Registro do módulo via `externalDb.createModule` (hook `useEnsureHelpCenterModule`, padrão dos demais módulos) + ícone novo no `iconMap`.
- Estrutura: `src/pages/ajuda/` (viewer) e `src/pages/ajuda/studio/` (admin), hooks em `src/hooks/useHelpCenter.ts`.
- Conteúdo é global (sem `client_id`); apenas escrita gated por permissão no frontend, como nos demais módulos.

## Etapas de implementação

1. Migração (tabelas + GRANTs + RLS) e bucket `help-media`.
2. Registro do módulo, ícone e rotas protegidas.
3. Studio: categorias, lista de posts e editor rico com upload de imagem/vídeo e embed do YouTube.
4. Central Netflix: hero de destaques, trilhas, busca e página de leitura.
5. Trilhas automáticas (recentes, mais vistos, continue lendo) e polimento visual.