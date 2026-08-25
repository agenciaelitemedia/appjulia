# Plano: nova rodada de diagnóstico de performance após as otimizações

## Objetivo
Revalidar gargalos, erros e oportunidades de melhoria depois das mudanças recentes no JulIA Chat, ingestão UaZapi e cache do banco legado, separando o que ainda está acontecendo agora do que aparece apenas como estatística acumulada antiga.

## Diagnóstico já confirmado nesta checagem
- Backend/database está operacional.
- Uso atual: memória 35%, disco 62%, conexões 31/240 e pool 8/1000, sem sinal imediato de saturação de infraestrutura.
- Build atual está OK.
- Não apareceram erros recentes nos logs do banco nas últimas 2 horas.
- Logs recentes das funções `uazapi-chat-webhook`, `db-query` e `julia-chat-list-feed` não mostraram erros filtrados por `error`/`external error`.
- A função `julia-chat-list-feed` ainda tem chamadas lentas quando precisa renovar cache legado: exemplos recentes ficaram em ~2,3s a ~2,5s, com maior peso em banco legado externo (~1,5s a ~1,7s) e leitura/cache via backend (~540ms).
- Quando não há renovação/resultado relevante, chamadas recentes ficaram por volta de ~250ms.
- `chat_legacy_cache` está usando índice por `(client_id, phone_key, cod_agent)`; uma leitura pontual por chave explicou em ~0,1ms no banco, então a lentidão de ~540ms parece estar no caminho função/API/cold start/rede, não na busca SQL simples isolada.
- Os maiores itens em “slow queries” ainda mostram consultas antigas com `ILIKE` em `chat_messages`, mas esta métrica é acumulada. O código atual do `uazapi-chat-webhook` usa a RPC `chat_resolve_message_ids`, então o próximo passo é provar se ainda existe tráfego residual antigo ou se é apenas histórico acumulado.
- `uazapi_history_items` já possui índice para `(status, processed_at desc)` e uma consulta pontual atual explicou rápido; o item lento também pode ser estatística acumulada ou vir de tela/polling específico.

## Plano de ação

### 1. Criar linha de base pós-mudanças
- Coletar uma amostra curta de chamadas reais do `/chat` durante uso normal.
- Separar tempos por:
  - `total_ms`
  - `supabase_ms`
  - `cache_ms`
  - `external_ms`
  - `cache_hits`
  - `cache_refreshed`
  - `changed` vs `touched`
- Classificar as chamadas em três cenários:
  - cache fresco
  - cache expirado com renovação legado
  - filtros pós-merge/CRM Julia/campanha

### 2. Confirmar se as queries antigas com `ILIKE` ainda rodam
- Cruzar slow queries acumuladas com logs recentes e pontos de código que consultam `chat_messages.message_id/external_id`.
- Se houver tráfego atual antigo, localizar a origem exata e migrar para `chat_resolve_message_ids`.
- Se for apenas estatística histórica, documentar como “resolvido, ainda visível por acumulado” e acompanhar queda relativa nos próximos ciclos.

### 3. Otimizar o caminho lento do cache legado
- Manter o isolamento por escritório já implementado (`phone_key + cod_agent`).
- Transformar a renovação do cache legado em padrão stale-while-revalidate:
  - quando houver cache antigo, devolver a lista imediatamente com dado antigo marcado como stale;
  - atualizar o cache em background;
  - no botão de recarregar manual, permitir aguardar a renovação completa.
- Resultado esperado: a lista deixa de esperar os ~1,5s a ~1,7s do banco legado na abertura normal.

### 4. Reduzir escrita e bloat residual do cache
- Medir se `touched` continua alto após o aumento de TTL.
- Se continuar, ajustar a estratégia para reduzir updates repetidos de `fetched_at`, por exemplo:
  - tocar apenas linhas realmente vencidas com margem mínima;
  - agrupar renovações em lote menor;
  - evitar refresh simultâneo da mesma chave quando várias abas/usuários abrem o chat.

### 5. Revisar polling e consultas repetitivas no frontend
- Revisar os hooks que aparecem nos logs recentes:
  - presença de equipe (`user_presence_status`)
  - conversas adiadas/snooze
  - opções de filtros do chat
  - histórico UaZapi em configurações
- Ajustar intervalos, `staleTime` e invalidações para evitar refetch desnecessário sem perder atualização em tempo real.

### 6. Priorizar próximos gargalos prováveis
- `chat_contacts.unread_count`: confirmar se updates redundantes ainda acontecem depois da guarda adicionada.
- `uazapi_history_items`: validar se os contadores/telas de histórico ainda fazem consultas com contagem pesada.
- `chat_conversations.assigned_to`: cachear melhor lista de responsáveis/opções para não consultar em excesso.
- `chat_messages` por conversa: revisar índice/consulta das últimas mensagens se ainda aparecer lento em tráfego atual.

### 7. Entrega esperada
- Relatório comparando antes/depois das mudanças recentes.
- Lista de gargalos atuais comprovados, com severidade e impacto.
- Correções pontuais para os gargalos confirmados, sem alterar comportamento visual do chat.
- Validação final com logs mostrando redução de tempo nas chamadas críticas.

## Critérios de sucesso
- Abertura padrão do `/chat` sem filtros legados deve ficar estável abaixo de ~500ms no backend da função.
- Abertura com cache legado expirado não deve bloquear a lista aguardando o banco externo, exceto em recarregamento manual.
- Nenhuma consulta atual com `ILIKE` em `chat_messages.message_id/external_id` deve continuar rodando.
- `chat_legacy_cache` deve manter baixo bloat e baixo volume de updates por linha.
- Sem regressão em badges de Júlia, campanha, CRM Builder, snooze e contadores das abas.
