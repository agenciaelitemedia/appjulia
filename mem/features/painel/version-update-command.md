---
name: Comando "atualizar vX.YZ"
description: Ao receber "atualizar v2.19" (ou similar), bump de versão em package.json + public/version.json e nova entrada no Changelog
type: preference
---

Ao receber uma mensagem no formato `atualizar vX.YZ` (ex.: `atualizar v2.19`):

1. Definir `"version": "X.YZ.0"` em `package.json` **e** `public/version.json`.
   - O build injeta isso em `__APP_VERSION__` e ambos os locais de exibição atualizam sozinhos:
     badge do JulIA Chat (`src/modules/julia-chat/pages/JuliaChatPage.tsx`) e menu do perfil
     (`src/components/layout/Header.tsx`), ambos via `APP_VERSION_LABEL` de `src/lib/appVersionLabel.ts`.
2. Adicionar a entrada da nova versão no topo de `src/pages/configuracoes/components/ChangelogTab.tsx`,
   descrevendo o que mudou desde a versão anterior.
3. Nada além disso; sem perguntas de confirmação.

**Como funciona a versão:** `vite-plugin-auto-version.ts` usa o maior MAJOR.MINOR entre
`package.json` e `public/version.json` e incrementa o PATCH a cada build de produção.
