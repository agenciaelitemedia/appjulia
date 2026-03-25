# Ajustar popup de chat para suportar UaZapi e API Oficial (WABA)

## Status: ✅ Implementado

## O que foi feito

### 1. Edge function `waba-send` criada
- Actions: `send_text` (envia texto via Graph API) e `download_media` (baixa mídia via media_id)
- Busca credenciais WABA (`waba_token`, `waba_number_id`) do banco externo por `cod_agent`
- Tokens nunca expostos ao frontend

### 2. `WhatsAppMessagesDialog` atualizado
- Detecção automática de provider via campo `hub` na tabela `agents`
- **UaZapi**: mantém fluxo original intacto (UaZapiClient)
- **WABA**: carrega mensagens da tabela `webhook_logs`, envia via edge function `waba-send`
- Parser dedicado para payload Meta (text, image, video, audio, document, sticker, location, contacts)
- Download de mídia WABA via edge function (proxy da Graph API)
- Paginação funciona para ambos os providers
