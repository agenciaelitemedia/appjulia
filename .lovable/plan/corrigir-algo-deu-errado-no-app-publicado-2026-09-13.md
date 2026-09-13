# Corrigir "Algo deu errado" no app publicado

## O que está acontecendo

Depois de entrar, qualquer tela do app publicado (https://acesso.atendejulia.com.br/dashboard) mostra a tela de erro com a mensagem "Class extends value undefined is not a constructor or null".

Causa confirmada na versão publicada: a biblioteca de telefonia (usada pelo softphone que é carregado no layout logado, em todas as páginas) depende de um módulo interno do Node chamado `events`. No pacote gerado para o navegador esse módulo foi substituído por um arquivo vazio, então a biblioteca tenta se apoiar em algo que não existe e quebra assim que o layout logado é montado. Verificado no arquivo publicado `assets/PhoneContext-*.js`, que importa o substituto vazio `__vite-browser-external-*.js` (conteúdo: `{}`) e tem 14 classes dependendo dele.

Isso não aparece na pré-visualização porque o modo de desenvolvimento resolve esse módulo de outra forma; só o pacote de produção é afetado.

## Correção

1. Declarar explicitamente o pacote `events` (versão compatível com navegador, já presente na pasta de dependências) como dependência do projeto.
2. Em `vite.config.ts`, apontar o nome `events` para esse pacote real, para que o pacote de produção use a implementação de navegador em vez do arquivo vazio.
3. Não mexer em nada do softphone/telefonia em si — é só ajuste de empacotamento.

## Validação

- Rodar verificação de tipos e build de produção.
- Conferir no resultado do build que o trecho da telefonia não importa mais o substituto vazio.
- Abrir a pré-visualização logada e confirmar que o painel carrega sem a tela de erro.
- Publicar e reabrir `/dashboard` no endereço publicado para confirmar.

## Detalhes técnicos

- Adicionar `"events": "^3.3.0"` em `dependencies`.
- Em `vite.config.ts`, dentro de `vite: { ... }`, incluir:
  `resolve: { alias: { events: 'events/events.js' } }` (apontar para o arquivo do pacote evita loop de resolução com o built-in).
- Manter o restante da configuração intacto; nada de `ssr.external` / `resolve.external` (quebra o build do worker).
- No servidor (worker com `nodejs_compat`) o mesmo alias é inofensivo, pois o pacote `events` é JavaScript puro.

## Fora de escopo

- Os erros de fila de entrada do WhatsApp (`chat-inbound-worker` com timeout 504) aparecem nos registros, mas são outro assunto e não causam esta tela de erro.
