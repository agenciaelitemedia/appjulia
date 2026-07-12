## Objetivo
Trocar a versão do app de timestamp numérico para um número semver legível (ex: `v1.2.15`), usando o `package.json` como fonte da verdade.

## Alterações propostas

1. **`package.json`**
   - Atualizar `"version"` de `"0.0.0"` para `"1.2.15"`.

2. **`vite.config.ts`**
   - Ler a versão do `package.json` em vez de gerar `Date.now()`.
   - Manter o plugin que grava `dist/version.json` no build, agora com a versão do package.

3. **`public/version.json`**
   - Atualizar `"version"` para `"1.2.15"` para evitar falso-positivo de atualização em dev/preview.

4. **`src/components/layout/Header.tsx`**
   - Remover a lógica que interpreta o timestamp como data/hora.
   - Exibir diretamente `v{__APP_VERSION__}` (ex: `v1.2.15`).
   - Manter o fallback `dev` quando a variável estiver vazia.

5. **`src/lib/appVersion.ts`**
   - Manter a comparação string contra `/version.json` (funciona corretamente com semver).
   - Garantir que preview/localhost continuem ignorando o reload.

## Resultado esperado
- Perfil do usuário mostrará **"Versão v1.2.15"**.
- Sistema de checagem de atualização continuará funcionando, disparando reload quando `version.json` publicado for diferente do bundle.
- Processo de build gera `version.json` com a mesma versão do `package.json`.

## Nota
Se quiser que a versão inicial seja outra (ex: `1.0.0`, `2.0.0`), é só informar o número no feedback.