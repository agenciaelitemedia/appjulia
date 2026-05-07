## Objetivo
Impedir que navegadores (Chrome/Google Translate, Edge, Safari, etc.) ofereçam ou apliquem tradução automática em qualquer parte do sistema.

## Mudanças

### 1. `index.html` — bloquear tradução globalmente
- Trocar `<html lang="en">` por `<html lang="pt-BR" translate="no">` (idioma correto evita o gatilho de tradução, e `translate="no"` instrui o navegador a não traduzir).
- Adicionar dentro do `<head>`:
  - `<meta name="google" content="notranslate" />` (desativa Google Translate)
  - `<meta http-equiv="Content-Language" content="pt-BR" />`
- Adicionar a classe `notranslate` no `<body>` (reforço usado pelo Chrome) e o atributo `translate="no"`.

### 2. Reforço no root da aplicação
- No `<div id="root">` aplicar `class="notranslate"` e `translate="no"` para garantir que toda a árvore React herde a regra mesmo se algum script alterar o body.

## Resultado esperado
- O ícone/menu “Traduzir esta página” do Chrome deixa de aparecer.
- Extensões que respeitam `translate="no"` / `.notranslate` não traduzem o conteúdo.
- Não há impacto visual nem funcional no app.

## Observação
Não é possível impedir 100% extensões de tradução que ignoram esses sinais (ex.: usuário forçando “Traduzir” manualmente no Chrome ainda funciona, pois é ação explícita do usuário). Esta é a forma padrão e recomendada pela web platform.