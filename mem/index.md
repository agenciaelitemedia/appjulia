# Project Memory

## Core
- Comando `atualizar vX.YZ`: setar version em package.json + public/version.json e criar entrada no Changelog (ver memória abaixo).

## Memories
- [Version Update Command](mem://features/painel/version-update-command) — Regra do comando "atualizar vX.YZ": bump de versão nos 2 arquivos + Changelog
- [UaZapi Msg Type](mem://technical/chat/uazapi-message-type-detection) — GIF/PTV são vídeo; fallback por mimetype antes de assumir imagem
- [Wavoip QR/Webphone](mem://technical/wavoip/qr-webphone-connection-flow) — conexão Wavoip é via QR + SDK; token não é Bearer REST; vínculo do usuário usa app_user_id
- [Wavoip History Sync](mem://features/wavoip/call-history-sync) — Sync 3-camadas (webphone, webhook, poll) + gravação no bucket privado
- [Wavoip API](mem://integrations/wavoip/api-reference) — Referência completa endpoints Wavoip V2 e WAV Painel; consultar sempre que citar "wavoip api"
- [BlitzLeads Module](mem://features/blitzleads/module-architecture) — Fake-projeto isolado (src/blitzleads/, prefixo blitzleads_, subdomínio blitzleads.atendejulia.com.br, rotas /BlitzLead/*, sidebar dark + mix-blend-mode)
- [n8n Execute Group](mem://features/n8n-execute/index) — Grupo de Edge Functions migradas do n8n (followup-stop, agent-and-followup-reactive); convenções e catálogo
- [Audio Transcription Multicanal](mem://technical/chat/audio-transcription-channel-aware) — chat-transcribe-audio para UaZapi e WABA (API Oficial)
- [X-Julia Calc Skill](mem://features/x-julia/calc-skill) — skill `calcular` obrigatória: renda per capita (BPC 1/4 SM), somas, %, parcelamento, expressões
- [Alertas WhatsApp](mem://features/notificacoes-alertas/module) — Módulo isolado de notificações por gatilho; padrão extend/ para módulos novos
- [Legacy Timestamps](mem://technical/database/legacy-naive-timestamps) — Datas das tabelas legadas são naive em BRT; gravar com nowDbTimestamp()
