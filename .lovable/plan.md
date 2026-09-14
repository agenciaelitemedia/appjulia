# Mostrar carregamento ao clicar em links

Hoje, ao clicar num link/menu para trocar de página, nada indica que algo está acontecendo: a tela antiga fica parada até a próxima página aparecer. Isso ocorre porque não existe nenhum indicador global ligado à navegação (a área de conteúdo usa um fallback vazio enquanto a nova página carrega).

## O que muda

1. **Barra de progresso no topo**
   Um fio fino com o gradiente da marca aparece no topo da tela assim que qualquer navegação começa (clique em link, menu, botão que muda de página, voltar/avançar do navegador) e desaparece quando a nova página está pronta.

2. **Mascote quando a espera passa de um instante**
   Se a navegação demorar mais de ~250 ms, além da barra aparece o mascote da Julia centralizado na área de conteúdo, com o texto "Carregando…". Para navegações rápidas nada pisca — só a barra.

3. **Fallback da área de conteúdo**
   O espaço vazio exibido enquanto a nova página é baixada passa a mostrar o mascote, em vez de ficar em branco.

4. **Cliques que não trocam de página continuam iguais**
   Botões de ação, abas internas e envio de formulários mantêm o comportamento atual (spinner do próprio botão).

## Detalhes técnicos

- Novo componente `src/components/layout/NavigationProgress.tsx`: usa `useRouterState({ select: s => s.status === 'pending' || s.isLoading })` do TanStack Router para acionar uma barra fixa (`fixed top-0 h-0.5 z-[100]`, `bg-brand-gradient`) com transição de largura, e um overlay leve com `MascoteLoader size="md" label="Carregando…"` após 250 ms de pendência.
- Montado uma única vez em `src/routes/__root.tsx`, dentro dos providers, junto ao `<Outlet />`.
- `src/routes/__root.tsx`: `Suspense fallback={null}` passa a `fallback={<MascoteLoader size="md" fullscreen />}`.
- `src/router.tsx`: acrescentar `defaultPendingMs: 250`, `defaultPendingMinMs: 300` e `defaultPendingComponent` usando `MascoteLoader`, para rotas com loader.
- Sem mudanças de rotas, dados ou lógica de negócio; apenas apresentação do estado de carregamento.
