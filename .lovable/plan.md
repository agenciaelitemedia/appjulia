# Copiloto Pro — botão "Analisar" sem reação: diagnóstico e correção

## O que está acontecendo

Ao clicar em "Analisar atendimento", o fluxo pede um token de autorização de 15 minutos. Se a senha da Julia não foi digitada (ou o campo não estava visível), o código lança o aviso interno `NEED_PASSWORD`, que hoje é **descartado em silêncio**: nenhuma mensagem, nenhum spinner, nenhuma resposta. Da sua perspectiva, o clique simplesmente não fez nada.

Três problemas somados, confirmados no código:

1. Em `MvpCopilotoPage.tsx` o `catch` do clique está vazio (`/* precisa de senha */`), então o pedido de senha nunca chega à tela.
2. O campo de senha só aparece quando `analysis.hasToken()` é falso, e essa checagem lê o `sessionStorage` fora do estado do React — ela não é reavaliada de forma confiável, então o campo pode não estar visível na hora do clique.
3. O campo fica **abaixo** do card de contexto, longe do botão, sem rótulo explicando que é obrigatório na primeira análise.

Detalhe adicional: o botão diz "Analisar atendimento com ChatGPT Pro", mas o Caminho 1 não usa sua conta ChatGPT — ele usa o modelo oficial do próprio gateway da Julia. O ChatGPT Pro só entra no Caminho 2 (conector MCP). O texto atual gera expectativa errada.

## Correção proposta (apenas no módulo do Copiloto)

**1. Autorização visível e no lugar certo**
- Mover o campo de senha para dentro do card "2. Contexto compilado", logo acima do botão, com rótulo "Autorizar análise — sua senha da Julia (válida por 15 min)".
- Controlar a existência do token por estado React (não por leitura direta do `sessionStorage`), de modo que o campo desapareça só depois de a autorização ser obtida com sucesso.

**2. Nunca mais um clique silencioso**
- Tratar `NEED_PASSWORD` como mensagem de usuário: "Informe sua senha da Julia para autorizar a análise (válida por 15 minutos)", exibida no card de resultado e como toast, com foco automático no campo de senha.
- Se o botão estiver bloqueado por falta de mensagens no histórico, mostrar o motivo em texto ("Este lead não tem mensagens para analisar") em vez de apenas desabilitar.
- Exibir também erros de senha inválida, token expirado e falha da IA (já retornados pelo backend) com texto em português.

**3. Rótulos honestos**
- Botão: "Analisar atendimento" (subtexto: "IA oficial da Julia — não usa sua conta ChatGPT").
- Card de resultado: trocar "A resposta da sua conta ChatGPT Pro aparece aqui" por "A análise jurídica aparece aqui em tempo real".
- No card de instruções, deixar explícito que o Caminho 1 usa a IA da Julia e o Caminho 2 usa sua assinatura ChatGPT/Claude Pro.

**4. Verificação do backend no mesmo passo**
- Conferir, via log da função de análise, se `copiloto-analisar` está respondendo (token válido, IA configurada). Se o gateway estiver retornando erro, ele passará a ser mostrado na tela com status e mensagem em vez de silêncio.

## Arquivos envolvidos

- `src/modules/mvp-copiloto/pages/MvpCopilotoPage.tsx` — estado da senha, tratamento do erro, textos.
- `src/modules/mvp-copiloto/components/ContextPreview.tsx` — campo de senha e motivo do bloqueio junto ao botão.
- `src/modules/mvp-copiloto/hooks/useCopilotoAnalysis.ts` — expor `needsPassword` como estado e propagar a mensagem em vez de engolir `NEED_PASSWORD`.
- `src/modules/mvp-copiloto/components/AnalysisResult.tsx` — texto do estado vazio.

Nenhuma mudança em Edge Functions, banco ou no conector MCP.

## Validação

1. Selecionar um lead com mensagens, clicar em Analisar sem senha → aparece o pedido de senha com foco no campo.
2. Digitar senha errada → mensagem "E-mail ou senha inválidos".
3. Digitar a senha correta → streaming da análise no card 3; segundo clique não pede senha novamente (15 min).
4. Selecionar lead sem mensagens → motivo explicado na tela.
