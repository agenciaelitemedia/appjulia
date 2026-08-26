---
name: Snooze cancelado quando o cliente responde
description: Mensagem recebida cancela automaticamente o retorno agendado da conversa; busca no chat nunca esconde adiadas
type: feature
---
Regra: quando entra mensagem do cliente (`from_me = false`), o trigger de banco `update_conversation_message_tracking` limpa `snoozed_until/snoozed_by/snooze_reason` da conversa e grava histórico `snooze_cancelled` ("Retorno agendado cancelado automaticamente — o cliente respondeu"). Vale para todos os canais porque a regra está no banco, não nos webhooks. Responsável e status não mudam.

Frontend (`src/modules/julia-chat`): quando há texto na busca, `hide_snoozed` é forçado para `false` (buscar por telefone/nome/protocolo deve sempre achar o lead) e a linha exibe badge violeta "Adiada até dd/mm hh:mm".
