# Limpeza das importações antigas de histórico

## Situação confirmada

- A recuperação de histórico ao conectar o WhatsApp funciona: 11.903 importações concluídas, a última em 11/09 (escritório 407, conexão "Pós vendas"), com cerca de 1.000 mensagens gravadas.
- Existem 438 importações com status de erro e 664 marcadas como "parcial", criadas entre 25/04 e 13/08. Todas foram encerradas automaticamente pela rotina de inatividade (a mensagem gravada é "encerrado automaticamente por inatividade (>2h)").
- Não há nenhuma importação travada neste momento (nenhuma em andamento ou aguardando).
- Junto delas há 2.482 linhas de detalhe com erro, todas de 01/09 ou antes.

## O que será feito

1. Arquivar as importações antigas encerradas por inatividade: as de erro e parcial com mais de 15 dias saem do relatório principal e ficam marcadas como encerradas por limpeza, junto com suas linhas de detalhe com erro.
2. Reduzir o tempo de espera antes de considerar uma importação travada, de 2 horas para 45 minutos, para que uma conexão que falhe apareça como problema no mesmo dia em vez de ficar pendurada.
3. Criar uma rotina diária de limpeza que faz o passo 1 sozinha de agora em diante, mantendo o relatório sempre enxuto.
4. Manter intactas todas as mensagens e contatos já importados — a limpeza mexe apenas no registro de execução das importações, nunca no conteúdo das conversas.

## Detalhes técnicos

- Ajuste de dados em `uazapi_history_runs`: linhas com `status in ('error','partial')`, `error` igual à mensagem de inatividade e `created_at < now() - interval '15 days'` passam a `status = 'archived'`; as linhas correspondentes em `uazapi_history_items` com `status = 'error'` são removidas.
- O job `uazapi-history-runs-timeout` (cron horário) troca o corte de `interval '2 hours'` para `interval '45 minutes'`.
- Novo job diário `uazapi-history-runs-archive` aplicando a mesma regra de arquivamento do item 1.
- Telas que leem `uazapi_history_runs` passam a ignorar `archived` na visão padrão, com opção de exibir o arquivo morto; nenhuma alteração em `chat_messages`, `chat_contacts` ou nas funções de importação.
