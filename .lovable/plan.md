## Objetivo

Atualizar automaticamente a versão exibida no perfil (`Versão vX.Y.Z`) a cada publicação, sem precisar editar `package.json` manualmente.

## Contexto atual

Hoje o número da versão vem de `__APP_VERSION__`, injetado pelo Vite a partir de `package.json`. Existe um plugin `vite-plugin-auto-version.ts` que tenta bumpar via `git log` na hora do build — mas isso **não funciona em produção Lovable** porque:

1. O build de publicação roda em ambiente gerenciado, sem histórico git local acessível ao plugin.
2. Mesmo se rodasse, o commit da publicação ainda não existe no momento em que o plugin lê o log.
3. Depender de mensagens de commit convencionais é frágil (o usuário não escreve `feat:`/`fix:` manualmente).

Ou seja: hoje a versão só muda se alguém editar `package.json` na mão.

## Proposta: versão baseada em build

Em vez de tentar interpretar commits, tratar cada publicação como um novo build e derivar a versão automaticamente disso. Duas opções:

### Opção A — Auto-incremento de PATCH a cada build (recomendado)

O plugin de build lê `public/version.json`, incrementa o PATCH e regrava antes do bundle ser gerado. Toda publicação vira uma versão nova sem esforço.

- `1.2.15` → publica → `1.2.16` → publica → `1.2.17` …
- MINOR e MAJOR continuam manuais (o usuário edita `public/version.json` quando quiser marcar um marco: nova funcionalidade grande = MINOR, quebra = MAJOR).
- Simples, previsível, não depende de git nem de mensagens de commit.

### Opção B — Versão = data+hora do build

Ignora semver e usa timestamp: `v2026.07.13-1423`. Sempre único, zero configuração, mas perde a noção de "release importante".

### Opção C — Manter semver por commits (o que está no plano antigo)

Continuar com `feat:` / `fix:` / `BREAKING CHANGE` decidindo o bump. Já vimos que é frágil no ambiente Lovable e exige disciplina de mensagens que o usuário não tem hoje.

## Implementação da Opção A (se aprovada)

1. **`vite-plugin-auto-version.ts`** — Simplificar: no hook `buildStart` (apenas quando `command === 'build'`), ler `public/version.json`, incrementar `patch`, regravar o arquivo E atualizar `package.json` para manter sincronizados. Retornar a nova versão para injetar em `__APP_VERSION__`.
2. **`vite.config.ts`** — Já chama `autoBumpVersion()`; ajustar para usar o valor retornado como fonte da verdade do `__APP_VERSION__` (em vez de reler `package.json`).
3. **Regras de MINOR/MAJOR manuais** — Documentar (em `.lovable/plan.md`) que, para marcar um MINOR (novo módulo) ou MAJOR (quebra), basta pedir "sobe a versão MINOR" / "sobe MAJOR" no chat e a AI edita `public/version.json` zerando o PATCH.
4. **Exibição** — `Header.tsx` e `ProfileSettingsPage.tsx` já mostram `v{__APP_VERSION__}`; nada a mudar.

## Resultado esperado

- Cada clique em **Publicar** → PATCH sobe sozinho.
- Sem risco de esquecer de atualizar o número.
- MINOR/MAJOR continuam sob controle intencional do usuário.

Qual opção prefere seguir?