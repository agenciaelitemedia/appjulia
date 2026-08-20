# Unificar loaders no mascote da Julia

Hoje aparece um spinner genérico (círculo de borda girando / ícone `Loader2`) antes do loader do mascote. Ele vem do carregamento de sessão do layout e dos guards de rota, e ainda existe em muitas páginas e painéis internos.

## O que muda

1. **Splash inicial (antes do React carregar)**
   Adicionar no `index.html` um splash leve com o mascote e o anel gradiente da marca, removido automaticamente quando o app monta. Assim não há flash de tela vazia nem spinner cru.

2. **Loader de sessão e guards**
   - `src/components/layout/MainLayout.tsx` (linha do círculo com `border-t-transparent`) → `MascoteLoader fullscreen`.
   - `src/components/guards/AdminRoute.tsx` e `src/components/guards/ProtectedRoute.tsx` → mesmo tratamento.

3. **Páginas e painéis inteiros**
   Substituir os blocos de "carregando" centralizados (Chat: Webhooks, SLA, Métricas, Automações; CRM: estatísticas, monitoramento; X-Julia; Flow Builder; Advbox; Notificações e Alertas; Wavoip/ZAP Call; Ajuda; etc.) por `MascoteLoader` (`size="md"` em página, `size="sm"` em painel/lista/card).

4. **Spinners médios de listas e cards**
   Onde o spinner marca o carregamento de uma lista, tabela ou card (não de um botão), usar `MascoteLoader size="sm"`.

5. **Botões permanecem como estão**
   Spinner pequeno (`Loader2`) dentro de botões e ações inline não muda.

## Detalhes técnicos

- Reusar `src/components/ui/mascote-loader.tsx`; acrescentar um tamanho `xs` (~24px) para uso em cards e linhas apertadas, e uma opção de layout inline (sem `min-h-[50vh]`).
- O splash do `index.html` usa CSS inline + `<img>` do mascote em `public/` (cópia estática de uma das poses) para não depender do bundle; keyframes de rotação e float declarados inline. Remoção via listener no `main.tsx` (ou simples `#root:not(:empty) + #aj-splash { display:none }`).
- Varredura por `animate-spin` (~240 ocorrências) classificada em: guard/página (troca por `MascoteLoader`), lista/card (troca por `size="sm"`/`xs`), botão (mantém). Sem mudanças de lógica ou de layout além do elemento de loading.
- Preservar `aria`/texto de carregamento existente passando `label` quando a tela já exibia um texto.
