# Disparos: imagem não sai quando o template tem botões

## O que foi verificado

- O template "Talvez nao precise de mais leads" tem imagem (`media_url` no bucket `creatives`) e **3 botões** de resposta rápida.
- A campanha "teste" copiou tudo certo: a variante gravada tem `media_url`, `media_type = image` e os 3 botões.
- Portanto o problema **não é perda de dados** no assistente nem no banco: é o formato do envio.
- No envio pela API não oficial (UaZapi), quando a variante tem botões o código monta **um único envio de menu de botões** (`/send/menu`) e apenas anexa a imagem como um campo extra (`file`). Esse campo não é o formato de mídia desse endpoint, então o provedor entrega só o texto com os botões — exatamente o comportamento relatado.
- Sem botões, o envio de imagem usa o endpoint correto de mídia (`/send/media`), que funciona.

## Como corrigir

1. **Confirmar o formato aceito pelo provedor**: testar num número próprio se o endpoint de menu aceita cabeçalho de imagem e com qual nome de campo. Isso decide entre 2 e 3 abaixo.
2. **Se aceitar**: usar o campo correto (com o tipo de mídia) num único envio — imagem + texto + botões numa só mensagem.
3. **Se não aceitar**: enviar em **duas mensagens em sequência** pela mesma fila — primeiro a imagem com o texto como legenda, depois a mensagem curta com os botões (com pequeno intervalo aleatório entre as duas, respeitando as regras anti-bloqueio). Áudio nunca vai junto com botões: nesse caso o áudio vai primeiro e os botões depois.
4. **Contagem e limites**: as duas mensagens contam como **um** destinatário nas métricas, mas consomem o limite da fila corretamente (evita estourar o volume sem perceber).
5. **Aviso no assistente**: quando o template tiver imagem/vídeo + botões e o canal for a API não oficial, mostrar na prévia que a mensagem pode chegar em duas partes.
6. **API Oficial**: imagem + botões continua exigindo template aprovado da Meta; o comportamento atual (recusa com motivo claro) permanece, sem mudança.

## Detalhes técnicos

- `supabase/functions/_shared/dsp-core.ts`: `buildOutboundPayload` passa a poder retornar **uma lista de envios** (`steps`) em vez de um só payload; para UaZapi com mídia + botões devolve `[/send/media (com legenda), /send/menu (texto curto + choices)]`. Sem botões ou sem mídia nada muda.
- `supabase/functions/dsp-campaign-worker/index.ts`: `sendMessage` itera os `steps` na mesma fila, aborta nos seguintes se o primeiro falhar, guarda o `providerId` do **primeiro** envio no destinatário e aplica jitter entre os passos. Contadores de fila incrementam por mensagem física; `dsp_recipients` continua 1 linha por contato.
- Nenhuma migração de banco; nenhum campo novo.
- Frontend: apenas o aviso em `CampaignWizardDialog.tsx` / `TemplatePreview.tsx`.
- Redeploy de `dsp-campaign-worker`; verificação com uma campanha de teste de 1 número.
