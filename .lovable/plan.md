## Objetivo
Automatizar o versionamento semver do app a cada publicação, incrementando **PATCH**, **MINOR** ou **MAJOR** conforme o tipo de mudança, e exibir a versão no menu de perfil.

## Contexto atual
- `package.json` = `1.2.15` (fonte da verdade).
- `vite.config.ts` lê `pkg.version`, injeta em `__APP_VERSION__` e gera `dist/version.json`.
- `Header.tsx` já mostra `v{__APP_VERSION__}` no menu de perfil.

## Regra de incremento (semver automático)

Baseado em **Conventional Commits** analisando as mensagens de commit desde a última versão publicada:

| Detecção na msg do commit | Incremento | Exemplo |
|---|---|---|
| `BREAKING CHANGE` ou `feat!:` / `refactor!:` | **MAJOR** → `1.2.15` → `2.0.0` | novo módulo que quebra fluxo antigo |
| `feat:` ou `feature:` (novo módulo/funcionalidade) | **MINOR** → `1.2.15` → `1.3.0` | novo módulo, nova tela, nova feature |
| Qualquer outro (`fix:`, `chore:`, `style:`, `refactor:`, ajustes) | **PATCH** → `1.2.15` → `1.2.16` | correções e ajustes |

**Como funciona na prática:** a Lovable já cria um commit por mensagem do usuário. Quando o usuário pedir algo como *"crie o módulo X"* ou *"adicione a funcionalidade Y"*, o commit vai conter `feat:` → MINOR sobe. Ajustes normais → PATCH sobe.

## Implementação

### 1. Novo plugin `vite-plugin-auto-version.ts`
Executa **apenas em `command === 'build'`**, antes do restante do pipeline:

1. Lê a versão atual do `package.json`.
2. Lê a versão publicada anterior de `public/version.json` (referência do último deploy).
3. Roda `git log <tag_ou_hash_anterior>..HEAD --pretty=%B` para pegar mensagens novas.
   - Fallback: se `git` não estiver disponível no ambiente de build, usa a **última mensagem de commit** (`git log -1`).
4. Determina o bump maior encontrado (MAJOR > MINOR > PATCH).
5. Aplica o bump, escreve de volta em `package.json` **e** em `public/version.json`.
6. Vite segue o fluxo normal usando o novo valor.

### 2. Comando manual de override (opcional)
Se o usuário pedir explicitamente ("sobe pra 2.0.0", "reset pra 1.0.0"), edito o `package.json` diretamente — o plugin respeita valores já bumpados no mesmo commit e não incrementa duas vezes (idempotência via marcador no commit ou checando se a versão já mudou desde o último `public/version.json`).

### 3. Exibição no perfil
Sem mudanças — `Header.tsx` já mostra `v{__APP_VERSION__}`.

### 4. Reload automático no navegador
Sem mudanças — `src/lib/appVersion.ts` já compara `/version.json` remoto vs embutido.

## Arquivos afetados
- **novo:** `vite-plugin-auto-version.ts`
- **editado:** `vite.config.ts` (registrar plugin)
- **auto-editado a cada build:** `package.json`, `public/version.json`

## Observações
- Convenção esperada nas mensagens: `feat:` para novos módulos/funcionalidades, `fix:`/`chore:` para ajustes, `!` ou `BREAKING CHANGE` para quebras.
- Se um commit vier sem prefixo reconhecido, cai em **PATCH** por segurança.
- Publicações em série sem novas features só sobem PATCH.
