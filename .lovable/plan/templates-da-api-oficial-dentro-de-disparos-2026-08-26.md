# Templates da API Oficial dentro de /disparos

## Objetivo
Na aba **Templates** de `/disparos`, além dos templates próprios (API não oficial), passar a gerenciar também os **templates da API Oficial (Meta/WABA)** — com a mesma tela de criação já existente na Julia, incluindo cabeçalho de mídia (imagem, vídeo, documento, localização), botões, rodapé e prévia do WhatsApp.

## Comportamento
- A aba Templates ganha dois sub-modos:
  - **Julia (não oficial)** — a lista atual, com fluxo de aprovação interno (rascunho → aprovação → aprovado).
  - **API Oficial (Meta)** — seleção da fila WABA, lista sincronizada da Meta com status (Ativo, Em análise, Rejeitado, Pausado…), busca e filtros por categoria/idioma/status, botão de sincronizar e exclusão.
- Botão **Novo template** no modo oficial abre o construtor em 3 passos (categoria → conteúdo → revisão), com:
  - Cabeçalho: nenhum, texto, imagem, vídeo, documento ou localização — com upload da amostra de mídia.
  - Corpo com variáveis `{{1}}`, `{{2}}`… e exemplos obrigatórios, rodapé e botões (resposta rápida, URL, telefone, copiar código).
  - Prévia em tempo real no estilo WhatsApp.
- Se o escritório não tiver nenhuma fila de API Oficial, o modo mostra um aviso explicando que é preciso conectar um número oficial antes.
- No modo Julia (não oficial), o formulário de criação/edição também passa a aceitar **mídia** (URL + tipo: imagem, vídeo, áudio, documento), já suportada pelos campos existentes do template, com o corpo servindo de legenda.

## Detalhes técnicos
- Novos arquivos no módulo (isolamento mantido):
  - `src/modules/disparos/extend/wabaTemplates.ts` — reexporta os hooks e componentes oficiais já existentes (`useWabaQueues`, `useWabaTemplatesCache`, `useSyncTemplates`, `useDeleteTemplate`, `useCreateTemplate`, `useUploadMediaHandle`, `TemplateBuilderDialog`, `WhatsappPreview`, `types`) de `src/modules/julia-chat/pages/config/waba-templates/`, sem duplicar lógica de API.
  - `src/modules/disparos/components/OfficialTemplatesPanel.tsx` — painel do modo oficial (seleção de fila, filtros, tabela de status, sincronizar, excluir, abrir construtor). Estrutura copiada de `WabaTemplatesPanel.tsx`, adaptada ao layout/cards do módulo de Disparos.
- `TemplatesTab.tsx`: adiciona `Tabs` internas (Julia / API Oficial) e mantém intacta a lista e o fluxo de aprovação atuais; no diálogo de template Julia, acrescenta campos `media_url` / `media_type` (já persistidos por `useSaveDspTemplate`).
- Sem migration: `dsp_message_templates` já tem `media_url` e `media_type`; templates oficiais continuam em `waba_templates` via edge function `waba-templates`.
- Nenhuma alteração nos workers de disparo nesta etapa.
