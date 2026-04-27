# Changelog — 23/04/2026 às 10h até 24/04/2026

---

## 🔧 Correções e melhorias no Webhook UaZAPI

| # | Tarefa | Horário |
|---|--------|---------|
| 1 | **Corrigiu parsing JSON do UaZapi** — tratamento incorreto de payload que causava falha silenciosa na ingestão de mensagens | 13:20 |
| 2 | **Corrigiu `last_message_at` e `last_message_text` no contato** — sem esses campos o contato não aparecia ordenado nem com preview na listagem após sync do histórico | 11:08 |
| 3 | **Corrigiu filtro de grupos no histórico** — grupos `@g.us` passavam pelo filtro e eram inseridos indevidamente como contatos individuais | 14:36 |
| 4 | **Corrigiu extração de mídia** — `media_url` não era extraído corretamente de todos os formatos de payload UaZapi (imageMessage, videoMessage, etc.) | 14:44 |
| 5 | **Bloqueou grupos no histórico** — camada adicional de bloqueio para garantir que grupos nunca entrem no pipeline de histórico | 15:30 |
| 6 | **Trocou alerta de instância por status "indisponível"** — melhor UX ao exibir estado de fila desconectada | 15:37 |
| 7 | **Desativou ALLOW_GROUPS do cliente 30** — configuração de permissão de grupos desligada para cliente específico | 15:55 |
| 8 | **Adicionou action `delete` na UaZapi** — possibilidade de remover instância diretamente pelo painel | 15:11 |
| 9 | **Corrigiu histórico incremental** — reconexão estava reprocessando mensagens antigas já salvas | 21:48 |
| 10 | **Corrigiu detecção de grupos** — heurística de `isGroupMessage` falhava em alguns formatos de payload | 22:37 |

---

## 🏗️ Novo sistema de fila de histórico

> Tabelas: `uazapi_history_runs` / `uazapi_history_items`  
> Edge functions: `uazapi-history-processor`, `uazapi-history-resume`, `chat-reset`

| # | Tarefa | Horário |
|---|--------|---------|
| 11 | **Adicionou webhook de histórico** — evento history enfileira items com payload persistido nas tabelas `uazapi_history_runs` e `uazapi_history_items` | 13:33 |
| 12 | **Adicionou processamento de fila** — edge function `uazapi-history-processor` consome runs pendentes e insere mensagens, criando contatos e conversas conforme necessário | 23:05 |
| 13 | **Corrigiu deadlock do processador** — condição de corrida onde dois workers tentavam processar o mesmo run simultaneamente | 00:28 |
| 14 | **Adicionou painel de contadores** — UI em Configurações mostrando totais por run (mensagens recebidas, inseridas, duplicadas, contatos criados) | 00:30 |
| 15 | **Corrigiu contatos LID (`@lid`) no UaZapi** — LinkedIDs eram salvos como telefone falso; `resolvePeerPhone()` agora descarta `@lid` e extrai o número real de campos alternativos (`sender_pn`, `chatid`, etc.) | 00:42 |
| 16 | **Corrigiu RLS para leitura das tabelas de histórico** — políticas de Row Level Security impediam o frontend de ler `uazapi_history_runs` e `uazapi_history_items` | 00:45 |
| 17 | **Resetou tabelas de webhooks no `chat-reset`** — ação de reset agora limpa também `uazapi_history_runs` e `uazapi_history_items` | 00:49 |
| 18 | **Adicionou ação `clear_storage`** — deleta arquivos de mídia do Storage sem resetar o banco | 01:04 |
| 19 | **Adicionou limpeza de mídias no reset** — ação de reset completo agora também apaga os arquivos do bucket | 01:05 |
| 20 | **Corrigiu filtro de `client_id`** — query de runs estava retornando runs de outros clientes por filtro incompleto | 01:21 |

---

## ⚡ Performance: sync de reconexão

> Arquivos: `uazapi-history-processor`, `uazapi-history-resume`, `uazapi-chat-webhook`

| # | Tarefa | Horário |
|---|--------|---------|
| 21 | **Filtro por `last_message_at` no processHistorySet** — na reconexão, filtra mensagens por timestamp antes do loop, processando apenas as do período de downtime | 17:59 |
| 22 | **Webhook dispara processor imediatamente após enqueue** — não espera mais o cron; fire-and-forget garante que runs são processados em segundos | 23:13 |
| 23 | **Filtro `last_message_at` no processor e no resume** — reconexão incremental aplicada também no fluxo novo de fila; contatos existentes ignoram mensagens anteriores ao último timestamp salvo | 23:13 |
| 24 | **Batch inserts de 100 mensagens por query** — substituiu 1 INSERT por mensagem; ~100× menos round-trips ao banco para históricos grandes; fallback one-by-one em caso de duplicatas mistas | 23:13 |
| 25 | **Profile fetch de novos contatos movido para background** — chamada HTTP à API WhatsApp não bloqueia mais a inserção das mensagens | 23:13 |
| 26 | **Default do drain aumentado de 5 → 25 itens** — cron processa lotes maiores por execução | 23:13 |
| 27 | **Índice parcial `idx_uazapi_history_items_drain`** — índice cobrindo exatamente a query de drain: `status='pending' AND attempts<5 ORDER BY created_at` | 23:13 |

---

## 💬 Interface do Chat

> Arquivos: `ChatList.tsx`, `ChatHeader.tsx`, `WhatsAppDataContext.tsx`, `NewConversationDialog.tsx`

| # | Tarefa | Horário |
|---|--------|---------|
| 28 | **Botão "Novo atendimento" no rodapé** — substituiu ícone antigo por formulário inline com DDI + telefone + botão Conversar | 15:49 |
| 29 | **`NewConversationDialog` aceita `initialPhone`** — pré-preenche o número ao abrir pelo rodapé da lista | 15:49 |
| 30 | **Tabs "Aguardando Atendimento" / "Em Atendimento" reestruturadas** — posicionadas acima da lista de conversas, com contagens visíveis | 15:56 |
| 31 | **Removida a aba "Todos"** — simplificação do fluxo; apenas Aguardando e Em Atendimento | 15:56 |
| 32 | **Removida a barra "Mostrando X de Y conversas"** — limpeza visual do cabeçalho | 16:19 |
| 33 | **Contagens das tabs sempre corretas independente da aba ativa** — `pendingConvCount` e `openConvCount` calculados via query própria sem filtro de status; badges corretas em ambas as abas simultaneamente, em tempo real via subscription | 16:28 |
| 34 | **Filtros ativos refletem nas contagens** — contagens consideram todos os filtros locais (período, responsável, SLA, modo, etapas) | 16:19 |
| 35 | **Assumir atendimento troca de aba automaticamente** — `handleTakeOver` chama `setConversationStatusFilter('open')` mantendo a conversa selecionada | 16:31 |
| 36 | **Fix: stale closure no `loadConversations`** — effect capturava versão antiga da função com filtro de status errado ao trocar de aba | 16:36 |
| 37 | **Fix: trocar tab pending→open sem re-fetch do banco** — introduzido `convQueryGroup`; pending e open compartilham grupo 'active', troca de aba é instantânea sem nova query ao Supabase | 16:43 |
| 38 | **Destaque visual na conversa selecionada** — card ativo com fundo diferenciado na lista | 19:53 |
| 39 | **Botão QR Code limitado ao modal** — não vazava mais para fora do componente de conexão de fila | 19:57 |

---

## 📊 Resumo

| Área | Tarefas |
|------|---------|
| Webhook UaZapi | 10 |
| Sistema de fila de histórico | 10 |
| Performance / sync de reconexão | 7 |
| Interface do Chat | 12 |
| **Total** | **39** |
