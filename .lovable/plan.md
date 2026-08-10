# Corrigir erro do ZapSign no editor do agente

## O que está acontecendo

O erro de CORS é enganoso: o navegador recebe uma resposta sem status OK no preflight porque a função `xj-zapsign` **não existe publicada no backend**. Verificado nesta sessão: o código existe no projeto (`supabase/functions/xj-zapsign/index.ts` e o helper `_shared/x-julia/zapsign.ts`), mas não há nenhum registro de log/boot dessa função no ambiente — ou seja, ela nunca chegou a ser implantada. Qualquer chamada do frontend falha antes de rodar uma linha de código.

## Correção

1. Publicar a função `xj-zapsign` no backend.
2. Validar de imediato:
   - preflight (OPTIONS) responde 200;
   - `GET ?case_id=...` retorna `{ template: null }` sem erro;
   - `POST { action: 'validate_token' }` responde (ok ou token inválido, não falha de rede).
3. Conferir se a tabela `xj_zapsign_templates` existe no banco; se não existir, criar a migração correspondente (com GRANTs e RLS) antes de testar o upload de modelo.
4. Conferir se o segredo do token ZapSign está configurado; se faltar, solicitar.
5. Ajustar o tratamento de erro no frontend (`useXJZapsign.ts`) para exibir uma mensagem clara em caso de falha de rede, em vez de deixar um erro não tratado no console.

## Detalhes técnicos

- Nenhuma mudança de lógica é necessária na função: os cabeçalhos CORS e o handler de OPTIONS já estão corretos.
- A correção é de implantação + verificação de dependências (tabela e segredo), mais um `catch` amigável no hook do wizard.
