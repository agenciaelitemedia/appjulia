# Skill "modo_audio" — responder por áudio quando o lead pedir/precisar

## Objetivo
Hoje o agente só responde em áudio quando o lead manda áudio. Passa a existir uma skill que o próprio agente aciona quando percebe que o lead prefere áudio (pediu explicitamente, disse que não pode ler, está sempre mandando voz, tem dificuldade com texto). Esse modo fica gravado na sessão e vale para as próximas respostas até ser desligado.

## Comportamento
- Nova skill `modo_audio` com parâmetros: `ativar` (true/false) e `motivo` (texto curto).
- Ao ativar: todas as respostas do turno em diante saem como nota de voz (mesmo padrão de voz atual: provedor/voice_id do agente).
- Ao desativar (lead pede "manda escrito"): volta para texto.
- Continua valendo o comportamento atual: lead manda áudio → resposta em áudio, mesmo sem a skill.
- Se a voz do agente estiver desligada ou a síntese falhar, cai para texto (com o evento de erro já existente na sessão).

## Tratamento de links no áudio
- Antes de sintetizar, o texto é varrido por URLs (http/https e domínios simples tipo `site.com.br/x`).
- Todo link é **removido do que vai ser falado** e enviado **em mensagem de texto separada**, na ordem: primeiro o áudio, depois cada link (com a frase curta que o acompanhava, quando houver).
- Links de mídia (.mp4, .jpg, .pdf, ...) continuam sendo enviados como mídia pelo caminho já existente.
- Se, depois de retirar os links, não sobrar texto falável, o agente envia só as mensagens de texto/mídia (sem áudio vazio).

## Rastreabilidade
- Evento na sessão (`voice`/`audio_mode`) quando o modo é ligado ou desligado, com o motivo informado pelo agente.
- Na tela de Sessões aparece um indicador de "modo áudio ativo".

## Detalhes técnicos
- Migration: coluna `audio_mode boolean default false` (+ `audio_mode_reason text`) em `xj_sessions`; GRANTs seguem o padrão da tabela.
- `_shared/x-julia/skills.ts`: declarar a tool `modo_audio` em `XJ_TOOLS` e tratá-la em `runXJSkill` (atualiza a sessão e registra evento).
- `_shared/x-julia/messaging.ts`: novo helper `extractLinks(text)` → `{ spoken, linkMessages[] }`, reaproveitando `URL_RE`/`detectMediaInBlock`; `xjSendComposed` permanece para os blocos de texto/mídia.
- `_shared/x-julia/runner.ts`: `wantsAudio` passa a ser `voice_enabled && (inbound é áudio || session.audio_mode)`; usar `extractLinks` para montar o texto falado e enviar os links depois do áudio.
- `_shared/x-julia/prompt.ts`: regra base explicando quando chamar `modo_audio` (pedido explícito ou sinal claro de preferência) e que links nunca são narrados.
- `types.ts`: campo `audio_mode` em `XJSession`.
- Frontend: apenas exibição do indicador na sessão (`SessionsPage`/`SessionDetailPage`).
