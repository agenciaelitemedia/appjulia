

# Botao Atualizar nos Logs + Transcrição Real de Áudio + Resumo de Mídias

## Problema Identificado na Transcrição

A transcrição está **completamente errada** porque as URLs de mídia do WhatsApp são **criptografadas** (`.enc` em `mmg.whatsapp.net`). Quando a função baixa o arquivo direto dessa URL, recebe dados criptografados ilegíveis. O modelo de IA então **inventa** uma transcrição falsa. A solução é usar o endpoint `/message/download` da UaZapi que retorna o áudio decriptado em base64.

## Plano de Implementação

### 1. Botao Atualizar nos Logs (SupportLogsTab.tsx)

Adicionar botao `RefreshCw` ao lado da busca no header, que chama `loadMessages()` com feedback visual (ícone girando durante loading).

### 2. Corrigir Transcrição de Áudio (support-transcribe-audio)

**Causa raiz**: Download direto da URL criptografada do WhatsApp.

**Correção**:
- Buscar config da instância UaZapi em `support_assistant_config` (api_url, instance_name, api_key/instance_token)
- Usar endpoint `/message/download` da UaZapi passando o `message_id` para obter o áudio decriptado em base64
- Enviar o base64 decriptado para o Lovable AI Gateway para transcrição real
- Fallback: se `/message/download` falhar, marcar como `[Transcrição indisponível - mídia expirada]` em vez de inventar

**Mudanças na query**: Além de `media_url`, buscar também `message_id` e `raw_payload` para extrair o ID da mensagem original necessário para o download.

### 3. Resumo de Imagens/Documentos no Webhook (support-assistant-webhook)

Alterar o webhook para que, ao receber imagens e documentos, grave uma descrição mais útil:

- **Imagens**: Gravar `is_transcribed: false` e na função de transcrição, baixar a imagem via `/message/download` e enviar ao Lovable AI para descrever o conteúdo (ex: "📷 Imagem do cliente: captura de tela de conversa sobre contrato")
- **Documentos**: Gravar nome do arquivo quando disponível: `📄 Documento do cliente: contrato_2025.pdf`
- **Textos longos**: Manter como estão (já são gravados corretamente)

### 4. Expandir support-transcribe-audio para processar mídias

Renomear conceitualmente para "processar mídias pendentes" — além de áudios, processar:
- **Imagens** (`is_transcribed: false`): baixar via UaZapi, enviar ao AI para descrição visual
- **Documentos** com caption vazia: registrar apenas o tipo e nome do arquivo

## Arquivos Alterados

| Arquivo | Mudanca |
|---|---|
| `SupportLogsTab.tsx` | Adicionar botao Atualizar com RefreshCw |
| `support-transcribe-audio/index.ts` | Usar `/message/download` da UaZapi para obter mídia decriptada; processar imagens também |
| `support-assistant-webhook/index.ts` | Marcar imagens como `is_transcribed: false` para processamento posterior; incluir nome do arquivo em documentos |

## Detalhes Técnicos

Fluxo de download via UaZapi:
```text
1. Buscar config: support_assistant_config → api_url, instance_name, api_key
2. POST {api_url}/{instance_name}/message/download 
   body: { id: message_id }
   headers: { apikey: api_key }
3. Resposta: { base64: "...", mimetype: "audio/ogg" }
4. Enviar base64 ao Lovable AI para transcrição/descrição
```

Nao será necessária API do Groq — o Lovable AI Gateway (já configurado com `LOVABLE_API_KEY`) suporta áudio multimodal com Gemini, basta que o áudio esteja decriptado.

