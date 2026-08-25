# Versão única no Chat e no menu do perfil + comando "atualizar vX.YZ"

## Situação atual
- O Chat mostra a versão como texto fixo (`v2.18`) no cabeçalho da lista.
- O menu do perfil (Header) mostra "Versão v{build}", derivada do `__APP_VERSION__` gerado no build (ex.: 1.2.47) — número diferente do exibido no chat.

## O que será feito
1. Criar uma fonte única da versão do Painel: `src/lib/panelVersion.ts` exportando `PANEL_VERSION = 'v2.18'`.
2. O badge do Chat passa a ler dessa constante (nada de texto fixo).
3. O menu do perfil passa a exibir a mesma constante ("Versão v2.18"), no lugar da versão de build.
4. Registrar na memória do projeto a regra do comando de atualização.

## Regra do comando (será salva na memória)
Ao receber uma mensagem no formato `atualizar vX.YZ` (ex.: `atualizar v2.19`):
1. Atualizar `PANEL_VERSION` em `src/lib/panelVersion.ts` — isso já reflete no badge do Chat e no menu do perfil.
2. Adicionar a entrada da nova versão no topo de `src/pages/configuracoes/components/ChangelogTab.tsx`, descrevendo o que mudou desde a versão anterior (com base nas alterações feitas na sessão).
3. Nenhuma outra alteração; sem perguntas de confirmação.

## Detalhes técnicos
- Arquivos: novo `src/lib/panelVersion.ts`; edições em `src/modules/julia-chat/pages/JuliaChatPage.tsx` e `src/components/layout/Header.tsx`.
- A versão de build (`__APP_VERSION__` / `/version.json`) continua intacta para o mecanismo de reload por nova versão — apenas deixa de ser exibida no menu do perfil.
- Memória: `mem://features/painel/version-update-command` + linha em Core no índice.
