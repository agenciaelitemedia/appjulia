# Números estranhos (120363…) entrando no chat da fila MRA

## O que os dados mostram (verificado agora)

- Os contatos com número tipo `120363172194567492` na fila MRA (`client_id 30`) não são telefones: são identificadores de **canais/comunidades do WhatsApp** (o próprio pacote traz `chatid: "120363172194567492@newsletter"`).
- Eles chegaram pelo caminho da **restauração de histórico** (as mensagens têm marca `uazapi_history_resume`), e os últimos foram criados hoje, 14/09, entre 00:01 e 00:08.
- Hoje o sistema só descarta conversas de **grupo** (`@g.us`) e identificadores internos (`@lid`). **Canal (`@newsletter`) e lista de transmissão (`@broadcast`) não são reconhecidos**, então o identificador do canal é aceito como se fosse telefone.
- No caminho das mensagens novas (tempo real) existe um limite de tamanho do número que barra esses identificadores; no caminho do histórico esse limite não existe — daí o vazamento.
- Hoje há 181 contatos nessa situação no sistema (156 no cliente 30, 22 no 175 e 3 avulsos), com um volume grande de mensagens ligadas a eles. Parte desses registros pode ser de grupos legítimos (quando o escritório permite grupos), então não serão apagados às cegas.

## O que será feito

1. **Reconhecer canal e lista de transmissão como não-telefone**: qualquer identificador `@newsletter`, `@broadcast`, `status@broadcast` ou `@lid` deixa de ser aceito como telefone de contato, na restauração de histórico e no recebimento normal, em todas as filas e provedores.
2. **Validar o tamanho do número**: o telefone só é aceito com 10 a 15 dígitos, o mesmo critério já usado nas mensagens novas — isso barra qualquer identificador longo futuro, inclusive formatos novos do WhatsApp.
3. **Registrar o descarte**: pacotes/mensagens descartados por serem canal ou transmissão ficam contabilizados no relatório de histórico e no log de mensagens descartadas, com o motivo, em vez de desaparecerem.
4. **Limpar o que já entrou, com segurança**: separar os registros em duas listas — canais/transmissões (a serem marcados como não-contato e ocultados da lista de atendimentos) e grupos legítimos (mantidos como são). Nada é apagado; a lista final é conferida antes de aplicar.
5. **Conferir depois de aplicar**: nova checagem confirma que nenhum contato novo com esse formato aparece e que a fila MRA volta a mostrar apenas conversas reais.

## Detalhes técnicos

- `supabase/functions/uazapi-chat-webhook/index.ts`: em `resolveHistoryPhone` (linha ~509), rejeitar candidatos com `@newsletter`/`@broadcast` e aplicar faixa de dígitos 10–15; no pré-filtro de `enqueueHistoryRun`, contar esses descartes em um contador próprio (`skipped_channel`) separado de `skipped_lid`; no caminho ao vivo (linha ~1646), acrescentar as mesmas exclusões de sufixo antes do `normalizePhone`.
- `supabase/functions/uazapi-history-resume/index.ts`: `isGroupJid`/`isLidJid` ganham irmão `isChannelJid` (newsletter/broadcast) usado em `resolvePeerPhone` e no filtro de mensagens do run.
- Centralizar os predicados em `supabase/functions/_shared/phone-normalize.ts` (`isNonPhoneJid(jid)`, `isValidMsisdn(digits)`) e consumir nos dois arquivos, evitando divergência entre caminhos.
- Diagnóstico já feito: `queues` (MRA = `9ddbf116-3ca0-4b29-8909-28f9eee0f026`, client 30, uazapi), `chat_contacts where phone ~ '^1203'` (181 linhas), `chat_messages.metadata->>'source' = 'uazapi_history_resume'` e `raw_payload.chatid` com sufixo `@newsletter`.
- Limpeza de dados: classificar via `chat_conversations.remote_jid`/`raw_payload` (contendo `@g.us` = grupo legítimo, `@newsletter`/`@broadcast` = descartar da lista), marcando os inválidos por flag/metadata em vez de `DELETE`, preservando mensagens.
- Sem alteração de schema. Verificação: typecheck, build, publicação das duas functions e reconsulta dos contatos criados após o deploy.
