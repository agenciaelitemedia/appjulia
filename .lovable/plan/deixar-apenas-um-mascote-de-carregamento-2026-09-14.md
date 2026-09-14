# Deixar apenas um mascote de carregamento

Hoje aparecem dois mascotes ao mesmo tempo durante a troca de página: um vem do indicador global de navegação (o mascote centralizado dentro de um cartão branco) e o outro vem do carregamento da própria página (mascote solto, sem cartão). Por isso a tela mostra duas imagens simultâneas, como na captura enviada.

## O que muda

1. O indicador global passa a mostrar **somente a barra fina de progresso no topo** — sem mascote.
2. O mascote continua aparecendo **uma única vez**, no centro da área de conteúdo, enquanto a nova página carrega.
3. Nada mais muda: velocidade, rotas, dados e botões seguem iguais.

## Detalhes técnicos

- `src/components/layout/NavigationProgress.tsx`: remover o overlay do mascote (estado `showMascote`, timer de 250 ms e o bloco `role="status"`), mantendo apenas a barra `fixed top-0 h-0.5 bg-brand-gradient`.
- `src/router.tsx`: manter `defaultPendingMs`/`defaultPendingMinMs` e o `defaultPendingComponent` com `MascoteLoader size="md" fullscreen` como única fonte do mascote.
- `src/routes/__root.tsx`: manter o `Suspense fallback={<MascoteLoader size="md" fullscreen />}` (não coexiste com o pending component na mesma transição).
