# Mensagem enviada (link do Google) não aparece no chat da Julia

## Por que não apareceu — diagnóstico confirmado nos dados

A conversa do lead `553488860163` está na fila **API Oficial (WABA)**, não UaZapi. Isso muda tudo:

- Na UaZapi, tudo que sai do número volta como evento no webhook, então o chat grava sozinho.
- Na **API Oficial da Meta, não existe eco de mensagens enviadas**. A Meta só manda de volta os *status* (`sent`, `delivered`, `read`) — e o status **não carrega o conteúdo** da mensagem.

Consequência: uma mensagem enviada por WABA só existe no chat da Julia se quem enviou também registrar na plataforma (chamada `waba-send` → `log_outbound`).

O que os dados mostram nesse atendimento, às 10:10 de 28/08:

- A Meta confirmou **4 mensagens enviadas** (4 status `sent`, wamids terminando em `...B0B1919`, `...D3E3EAE`, `...7D08C5B` e `...A6B283B165CE7925FD`).
- A função `waba-send` foi chamada **3 vezes** (10:10:50, 10:10:53, 10:10:56) — todas com sucesso (HTTP 200).
- No banco há exatamente **3 mensagens** gravadas nessa janela, todas com `metadata.source = "n8n"`. A última é: *"Estamos por aqui sempre que precisar. E, se puder, você pode deixar uma avaliação do nosso atendimento no Google?"*.
- O 4º wamid (`...A6B283B165CE7925FD`, o bloco com `https://g.page/r/...`) **não tem nenhuma chamada de log** e **não existe** em `chat_messages`.

Ou seja: o link foi entregue no WhatsApp pela Meta (por isso você recebeu), mas o bloco do n8n que enviou esse último trecho **não registrou a mensagem na plataforma**. Não é falha de renderização de link no chat, não é filtro de preview, não é permissão — a mensagem nunca chegou ao banco. Não há erro em nenhuma edge function nesse intervalo, porque não houve requisição.

Por que só o bloco do link falhou: esse trecho final é enviado por um caminho diferente dos outros blocos no n8n (envio do link separado do texto), e nesse caminho o passo de registro na Julia não é executado.

## Como corrigir

Duas frentes: fechar o buraco na plataforma (para nunca mais depender de o n8n lembrar de logar) e recuperar a mensagem perdida.

### 1. Reconciliação automática por status (plataforma)

No `meta-webhook`, ao processar um status de saída (`sent`) cujo `wamid` **não existe** em `chat_messages`:

- criar a mensagem na conversa correta (contato + fila + conversa aberta), com `from_me = true`, `external_id = wamid`, horário do status e `metadata = { source: "meta_status_reconcile", content_unavailable: true }`;
- texto exibido: marcador claro do tipo *"Mensagem enviada pelo agente (conteúdo não registrado)"*, já que a Meta não fornece o conteúdo;
- **idempotência**: se depois o log correto chegar (`log_outbound` com o mesmo wamid), a função atualiza a linha existente com o texto/mídia real em vez de inserir duplicada.

Efeito: a timeline nunca mais fica com furo silencioso; se o conteúdo chegar, ele completa o registro automaticamente.

### 2. Aceitar o log tardio sem duplicar

Em `waba-send` (`log_outbound` e envios normais), gravar por *upsert* usando `external_id` (wamid) como chave de conflito, em vez de `insert` puro. Hoje um log repetido criaria duplicata; com o item 1 isso passa a acontecer com frequência.

### 3. Visibilidade das lacunas

Contador simples (log + registro) quando um status `sent` chega sem mensagem correspondente, para dar para medir se o fluxo n8n voltou a deixar blocos sem registro.

### 4. Correção retroativa desse lead

Inserir a mensagem faltante na conversa `0b761d2e...` com:

- texto real do link (`https://g.page/r/CX5dTlzQDa_FEAE/review` com o texto que você recebeu no WhatsApp),
- `external_id` = wamid real (`wamid.HBgMNTUzNDg4ODYwMTYzFQIAERgUQ0VBNkIyODNCMTY1Q0U3OTI1RkQA`),
- horário 28/08 10:10:59, `from_me = true`, `status = sent`, `source = "backfill_manual"`.

Assim o histórico volta a bater com o que o lead viu.

### 5. Ajuste recomendado no n8n (fora do código da Julia)

O bloco que envia o link precisa chamar `waba-send` (`log_outbound`) como os outros, ou — melhor — enviar **através** do `waba-send` (a plataforma fala com a Meta e grava na mesma operação). Sem isso, o item 1 salva a timeline, mas o texto do link continuará indisponível nos próximos envios feitos por fora.

## Detalhes técnicos

- Arquivos: `supabase/functions/meta-webhook/index.ts` (bloco de `value.statuses`, ~linha 748) e `supabase/functions/waba-send/index.ts` (`persistOutbound`, `log_outbound`).
- Necessário índice único em `chat_messages.external_id` (parcial, `where external_id is not null`) para o upsert; verificar antes se já existe duplicidade de `external_id` no banco e limpar se houver.
- Resolução de contato/conversa reaproveita a lógica já existente em `persistOutbound` (extraída para `_shared` para uso pelo webhook).
- Nenhuma mudança no front do chat: a mensagem reconciliada renderiza como texto normal e, quando completada com o conteúdo real, o preview de link já funciona.

## Validação

1. Reenviar pelo n8n um bloco com link para o número de teste e confirmar que a mensagem aparece no chat.
2. Simular status `sent` com wamid desconhecido e conferir a criação da linha marcada.
3. Enviar o `log_outbound` do mesmo wamid depois e conferir que a linha foi completada, sem duplicar.
4. Abrir a conversa do lead `553488860163` e confirmar a mensagem do link no horário correto.
