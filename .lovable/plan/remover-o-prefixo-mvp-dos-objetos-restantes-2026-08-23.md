# Remover o prefixo "mvp" dos objetos restantes

Hoje sobrou apenas nomenclatura interna com `mvp`: dois objetos no banco, uma edge function antiga e uma rota de redirecionamento. A UI já é 100% "JulIA Chat".

## O que existe hoje (verificado)

- Banco: tabela `mvp_chat_legacy_cache`, função `mvp_chat_list_feed(...)` (uma única versão), função de trigger `mvp_chat_legacy_cache_touch()` + trigger `trg_mvp_chat_legacy_cache_touch`.
- Edge functions: `julia-chat-list-feed` (em uso) e a cópia antiga `mvp-chat-list-feed` (não é mais chamada pelo frontend).
- `src/App.tsx`: rota `/mvp-chat` redirecionando para `/chat`.

## Mudanças

1. Migração de renomeação (sem perda de dados, preserva RLS/grants/índices):
   - `mvp_chat_legacy_cache` → `chat_legacy_cache`
   - `mvp_chat_legacy_cache_touch()` → `chat_legacy_cache_touch()` e trigger → `trg_chat_legacy_cache_touch`
   - `mvp_chat_list_feed(...)` → `chat_list_feed(...)` (mesma assinatura; corpo referenciando a tabela é ajustado se necessário)
2. Atualizar `supabase/functions/julia-chat-list-feed/index.ts` para chamar `chat_list_feed` e ler/escrever `chat_legacy_cache` (inclui a mensagem de log sobre versões duplicadas). Redeploy da função.
3. Excluir a edge function legada `mvp-chat-list-feed` (pasta + remoção da entrada em `supabase/config.toml`, se houver).
4. Remover a rota `/mvp-chat` de `src/App.tsx` (o alias `/julia-chat` → `/chat` continua).
5. `src/integrations/supabase/types.ts` é regenerado automaticamente após a migração.

## Ordem de execução (para não gerar erro em produção)

Renomear e fazer o deploy da edge function na mesma janela: a função antiga `mvp-chat-list-feed` deixará de funcionar no instante do rename, por isso ela é removida no mesmo passo. O frontend só chama `julia-chat-list-feed`, então não há downtime perceptível se o deploy acontecer junto com a migração.

## Notas técnicas

- Migrações antigas mantêm os nomes `mvp_*` no histórico — isso é esperado e não é editado.
- Nada de renomear a edge function `julia-chat-list-feed`: o nome já está sem `mvp` e o frontend depende dele.
