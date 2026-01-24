
Objetivo: corrigir o bloqueio “ERR_BLOCKED_BY_CLIENT” ao abrir o link do PDF do ZapSign (zapsign.s3.amazonaws.com). Esse erro normalmente não é “link errado”; é bloqueio do navegador/extensão (adblock/antitracking/antivirus) para o domínio do S3. A solução mais robusta é não abrir o link direto do S3 no browser e sim baixar o arquivo por um endpoint do nosso backend (proxy), para que o navegador só converse com o nosso domínio.

## Diagnóstico (por que está acontecendo)
1) Hoje o frontend faz:
   - chama `zapsign-download` → recebe `signed_file/original_file` (URL do S3)
   - executa `window.open(fileUrl, '_blank')`
2) Em muitos ambientes, extensões de bloqueio classificam domínios do S3 (ou URLs com query string de assinatura) como “trackers” e bloqueiam a navegação, gerando:
   - “zapsign.s3.amazonaws.com está bloqueado”
   - `ERR_BLOCKED_BY_CLIENT`

Conclusão: o link pode estar correto, mas o Chrome/extensão bloqueia o destino.

## Abordagem de correção (proxy/stream do arquivo)
Criar um novo backend function que:
1) Recebe `doc_token` (e opcionalmente qual arquivo: `signed` vs `original`)
2) Consulta a API do ZapSign para obter a URL temporária do arquivo (igual já fazemos)
3) Em vez de retornar a URL para o frontend, o backend faz `fetch()` dessa URL e devolve o conteúdo do PDF diretamente (stream) com headers de download.

Isso evita que o browser navegue até o S3 (logo, não aciona o bloqueio da extensão).

## Mudanças planejadas (arquivos)
### A) Backend: nova function `zapsign-file`
Criar: `supabase/functions/zapsign-file/index.ts`

Comportamento:
- CORS preflight (OPTIONS) obrigatório
- Entrada JSON:
  ```json
  { "doc_token": "…", "file": "signed" | "original" }
  ```
- Passos:
  1) Validar `doc_token` (string não vazia; opcional: formato UUID)
  2) Buscar detalhes do doc em:
     - `GET https://api.zapsign.com.br/api/v1/docs/{doc_token}/`
     - manter fallback atual para signer_token em `GET /api/v1/signers/{token}/` se retornar 404
  3) Selecionar URL:
     - se `file === "signed"` usar `signed_file` (se existir)
     - senão usar `original_file`
  4) Fazer `fetch(fileUrl)` e retornar `new Response(fileResponse.body, { headers… })` para stream sem carregar tudo na memória.
  5) Definir headers para forçar download e permitir o frontend ler headers:
     - `Content-Type: application/pdf` (ou repassar do S3 se vier)
     - `Content-Disposition: attachment; filename="contrato-{doc_token}.pdf"` (ou usar `docData.name` se vier)
     - `Access-Control-Allow-Origin: *`
     - `Access-Control-Expose-Headers: Content-Disposition, Content-Type`

Tratamento de erro:
- Se ZapSign retornar 404: devolver JSON com `success:false` + mensagem orientando “token não encontrado”.
- Se `signed_file` vazio e usuário pediu signed: devolver `success:false` “documento ainda não assinado”.
- Se o fetch do arquivo falhar: devolver `success:false` com status 200 (para UX/toast) + detalhes.

Observação importante:
- Resposta binária e resposta JSON convivem: quando sucesso, retorna PDF; quando erro, retorna JSON.
- No frontend, vamos detectar isso pelo status/Content-Type.

### B) Frontend: ajustar download no `ContratosTable.tsx`
Arquivo: `src/pages/estrategico/contratos/components/ContratosTable.tsx`

Trocar a lógica de download:
- Em vez de `window.open(fileUrl, '_blank')`, fazer download “de verdade” via backend function.

Implementação proposta:
1) Chamar a function `zapsign-file` com `fetch` (recomendado para lidar com blob/binary de forma explícita), por exemplo:
   - usar a URL base do backend functions já configurada no projeto (sem hardcode em texto; usar as variáveis já existentes do app).
2) Ler a resposta:
   - Se `Content-Type` indicar `application/json`, parsear e mostrar toast do erro.
   - Se for PDF (ou octet-stream), usar `await res.blob()` e disparar download:
     ```ts
     const blobUrl = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = blobUrl;
     a.download = fileName; // ex: `${contrato.signer_name ?? 'contrato'}.pdf`
     a.click();
     URL.revokeObjectURL(blobUrl);
     ```
3) Manter spinner/disable do botão durante o download.
4) UX de fallback:
   - Se ocorrer erro típico de bloqueio (ou falha de rede), exibir toast sugerindo:
     - “Pode ser extensão bloqueando downloads/URLs. Tente desativar adblock para este site.”
   - (Opcional) Adicionar ação “Copiar link” (se quisermos manter a URL), mas a solução principal passa a ser o proxy.

### C) Manter `zapsign-download` como está (opcional)
- Podemos manter `zapsign-download` retornando URLs (útil para debug/admin).
- O botão “Baixar” passa a usar `zapsign-file`.

## Sequência de execução
1) Implementar `supabase/functions/zapsign-file/index.ts` (novo).
2) Fazer deploy da function.
3) Atualizar `ContratosTable.tsx` para usar `zapsign-file` e baixar via blob.
4) Testar:
   - ambiente com adblock (onde hoje falha) deve passar
   - ambiente normal continua funcionando
5) Validar arquivos grandes:
   - se PDFs forem muito grandes e houver limite de tempo/tamanho do runtime, aplicar fallback (manter abertura por URL com aviso). Isso será decidido após teste real com um contrato grande.

## Critérios de aceite
- Clicar em “Baixar contrato assinado” não abre aba no S3.
- Download inicia dentro do navegador sem a tela “bloqueado”.
- Em caso de token inválido, a mensagem de erro fica clara e não quebra a página.
- Continua respeitando “links expiram em 60 minutos” porque a URL é gerada sob demanda no backend.

## Nota rápida ao usuário (para alinhar expectativa)
- “ERR_BLOCKED_BY_CLIENT” quase sempre é extensão/antivírus, não problema de link. A mudança para proxy resolve porque o download passa a vir do nosso próprio domínio, que normalmente não é bloqueado.
