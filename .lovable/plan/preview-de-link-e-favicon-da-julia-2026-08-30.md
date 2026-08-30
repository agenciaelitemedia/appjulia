# Preview de link e favicon da JulIA

Objetivo: o link `https://acesso.atendejulia.com.br` deve mostrar o banner "Seu WhatsApp virou uma bagunça de atendimento?" como imagem de preview, sem nenhuma referência ao Lovable, e o favicon passa a ser o ícone de balão gradiente enviado.

## O que muda

1. **Imagem de preview (og:image / twitter:image)**
   - Copiar a imagem 2 (banner Atende Julia) para `public/og-preview.png`, redimensionada para 1200x630 (proporção padrão de preview social), sem esticar.
   - Apontar `og:image`, `og:image:secure_url`, `og:image:width/height`, `og:image:alt` e `twitter:image` para `https://acesso.atendejulia.com.br/og-preview.png` (URL absoluta é obrigatória para os robôs de preview).

2. **Remover referências ao Lovable**
   - `index.html`: remover `og:image`/`twitter:image` apontando para `lovable.dev` e o `twitter:site` `@Lovable`.
   - Verificar `public/robots.txt`, `public/manifest.json` e `public/sw.js` e limpar qualquer menção remanescente.

3. **Favicon = imagem 3 (ícone do balão)**
   - Gerar `public/favicon.png` quadrado (64x64, fundo preservado) a partir da imagem 3 e substituir o atual.
   - Manter as tags `<link rel="icon">` e `<link rel="apple-touch-icon">` apontando para `/favicon.png`; remover `public/favicon.ico` para o navegador não sobrepor o novo ícone.
   - `public/manifest.json`: gerar também `public/icons/icon-192.png` e `public/icons/icon-512.png` a partir da imagem 3 e referenciá-los nos tamanhos corretos (hoje os dois entries apontam para o mesmo arquivo com tamanhos declarados incorretos).

4. **Onde o sistema usa só o ícone da logo**
   - Onde a interface precisar apenas do ícone (splash, cabeçalhos compactos), reutilizar o mesmo ícone do favicon via asset CDN, sem alterar os logotipos completos já existentes.

## Observações

- Título e descrição atuais ("JulIA - Gerencie sua IA...") permanecem como estão; o print mostra que só a imagem estava vinda do Lovable.
- Os robôs de preview (WhatsApp, LinkedIn, Facebook) mantêm cache da imagem antiga; após publicar, o preview novo só aparece quando eles reprocessam o link — dá para forçar no depurador de links de cada plataforma.
- A mudança só vale no domínio publicado depois de um novo publish.
