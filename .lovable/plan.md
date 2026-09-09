# Mensagens do lead 5584991341417 aparecem em branco

## O que está acontecendo

As mensagens **chegaram** e estão salvas (contato "(FIN) Soysla Maria dos Santos", conversa aberta com VICTORIA). Verifiquei as mensagens de hoje (10:27, 10:55, 10:55) e todas têm o mesmo conteúdo vindo do WhatsApp:

> "[Undecryptable] [text] Não foi possível descriptografar a mensagem. Abra o WhatsApp no seu celular para visualizá-la."

Ou seja, o WhatsApp entregou o aviso de que **não conseguiu abrir/descriptografar** o que a cliente enviou. Duas coisas somadas:

1. **Origem (fora do app):** a conexão do número de atendimento (5584 3206-2283) perdeu a chave de criptografia dessa conversa. É preciso abrir o WhatsApp no celular dessa conexão (ou reconectar a conexão) para o histórico voltar a descriptografar.
2. **No app (nosso bug):** por causa de uma proteção antiga que descarta textos começando com `[` (para não gravar dados técnicos), esse aviso é jogado fora e a mensagem é salva **sem texto nenhum** — por isso a bolha aparece vazia e parece que "nada chegou". Nos últimos 2 dias isso ocorreu em 31 mensagens.

## O que vou corrigir

1. **Parar de apagar o texto:** a proteção passará a descartar somente conteúdo que realmente é dado técnico (JSON), preservando avisos legítimos entre colchetes.
2. **Mostrar um aviso claro na conversa:** quando a mensagem for de falha de descriptografia, a bolha exibirá algo como "Mensagem não pôde ser descriptografada — peça ao cliente para reenviar", em vez de ficar em branco, e o mesmo texto aparecerá na prévia da lista.
3. **Recuperar as mensagens já salvas em branco:** preencher o texto dessas mensagens a partir do conteúdo original que já ficou guardado, para o atendente ver o que houve nas conversas dos últimos dias.
4. **Não mexer em mais nada:** envio, mídias, áudios e demais tipos continuam iguais.

## Detalhes técnicos

- `supabase/functions/uazapi-chat-webhook/index.ts`: em `extractMessageText`, o guard `s.startsWith('[')` rejeita o texto legítimo. Trocar por uma checagem de JSON de verdade (tentar `JSON.parse` apenas quando começa com `[`/`{` e rejeitar só se parsear em array/objeto). Mesmo ajuste em `buildLastMessagePreview`.
- Detectar `messageType === 'error'` / prefixo `[Undecryptable]` e normalizar para um texto amigável, marcando em `metadata.undecryptable = true`.
- UI do chat (`MessageBubble`): renderizar mensagem com `metadata.undecryptable` como aviso em destaque (estilo warning), sem alterar os outros tipos.
- Backfill: `UPDATE chat_messages SET text = coalesce(nullif(text,''), raw_payload->>'text') WHERE coalesce(text,'')='' AND raw_payload->>'text' LIKE '[Undecryptable]%'`.
- Fica de fora deste plano (ação operacional): reconectar/abrir o WhatsApp da conexão 558432062283 para resolver a causa raiz da falha de descriptografia.
