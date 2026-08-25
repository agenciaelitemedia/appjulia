# Versão única (build) no Chat e no menu do perfil + comando "atualizar vX.YZ"

## Situação atual
- O Chat mostra a versão como texto fixo (`v2.18`) no cabeçalho da lista.
- O menu do perfil (Header) já lê a versão real do build via `__APP_VERSION__` (hoje 1.2.47).

## Como a versão do build é atualizada
- Fonte: `package.json` + `public/version.json`; `vite-plugin-auto-version.ts` roda a cada build de produção (publish).
- MAJOR.MINOR = o maior valor entre os dois arquivos; PATCH é incrementado automaticamente em cada build.
- `vite.config.ts` injeta o resultado em `__APP_VERSION__` e grava `dist/version.json` (usado pelo reload automático quando sai versão nova).
- Portanto, para mudar MAJOR/MINOR basta editar manualmente `package.json` e `public/version.json` (ex.: `2.19.0`); o próximo build vira `2.19.1`.

## O que será feito
1. O badge do Chat passa a ler `__APP_VERSION__` (mesmo formato `v{versão}`) em vez do texto fixo — nenhum arquivo novo de versão.
2. O menu do perfil continua lendo `__APP_VERSION__`; a formatação `v{x.y.z}` fica idêntica nos dois lugares (helper simples compartilhado ou mesma expressão).
3. Registrar na memória do projeto a regra do comando de atualização.

## Regra do comando (será salva na memória)
Ao receber `atualizar vX.YZ` (ex.: `atualizar v2.19`):
1. Definir `version` como `X.YZ.0` em `package.json` e `public/version.json` — o build passa a exibir essa versão nos dois locais (Chat e menu do perfil) automaticamente.
2. Adicionar a entrada da nova versão no topo de `src/pages/configuracoes/components/ChangelogTab.tsx`, descrevendo o que mudou desde a anterior.
3. Nada além disso; sem perguntas de confirmação.

## Detalhes técnicos
- Edições: `src/modules/julia-chat/pages/JuliaChatPage.tsx` (badge) e, se útil, extrair o rótulo já existente em `src/components/layout/Header.tsx` para um helper em `src/lib/` que apenas formata `__APP_VERSION__`.
- Mecanismo de auto-reload por nova versão permanece intacto.
- Memória: `mem://features/painel/version-update-command` + linha em Core no índice.
