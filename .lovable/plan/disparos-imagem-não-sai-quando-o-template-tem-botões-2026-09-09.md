# Disparos: imagem não sai quando o template tem botões

## O que foi verificado

- O template "Talvez nao precise de mais leads" tem imagem (`media_url` no bucket `creatives`) e **3 botões** de resposta rápida.
- A campanha "teste" copiou tudo certo: a variante gravada tem `media_url`, `media_type = image` e os 3 botões.
- Portanto o problema **não é perda de dados** no assistente nem no banco: é o formato do envio.
- No envio pela API não oficial (UaZapi, que roda sobre **Baileys 7**), quando a variante tem botões o código chama o endpoint de menu de botões e apenas pendura a imagem num campo extra (`file`) que não é o formato de cabeçalho de mídia esperado. Resultado: chega só o texto com os botões — exatamente o relatado.
- Sem botões, a imagem usa o endpoint de mídia correto e funciona.

## Como corrigir

Na Baileys 7 a mensagem interativa aceita **cabeçalho de mídia junto com os botões**, então o alvo é **uma única mensagem**: imagem (ou vídeo/documento) no topo, texto, rodapé e botões embaixo — igual à prévia mostrada na tela.

1. Ajustar o envio de botões para incluir o cabeçalho de mídia no formato que o provedor repassa à Baileys (mídia + tipo + nome de arquivo), em vez do campo solto atual.
2. Validar com um envio real para um número próprio, comparando com a prévia.
3. **Fallback automático** apenas se o provedor recusar a mídia no menu: envia a imagem com o texto como legenda e, em seguida, a mensagem curta com os botões, com intervalo aleatório entre as duas e respeitando as regras anti-bloqueio. Nesse caso as duas partes contam como **um** destinatário nas métricas, mas consomem o limite da fila corretamente.
4. **Áudio**: a Baileys não suporta áudio como cabeçalho de botões — áudio vai sempre como mensagem separada antes dos botões.
5. **Aviso no assistente**: se cair no fallback (ou se o tipo for áudio), a prévia avisa que a mensagem chega em duas partes.
6. **API Oficial**: imagem + botões continua exigindo template aprovado da Meta; comportamento atual (recusa com motivo claro) permanece.

## Detalhes técnicos

- `supabase/functions/_shared/dsp-core.ts`: no caminho UaZapi com botões, montar o payload de menu com cabeçalho de mídia (campos de mídia/tipo/nome do arquivo aceitos pelo provedor) em vez do `file` avulso. `buildOutboundPayload` passa a poder devolver **uma lista de envios** (`steps`) para cobrir o fallback e o caso de áudio; com um único envio o comportamento atual não muda.
- `supabase/functions/dsp-campaign-worker/index.ts`: `sendMessage` percorre os `steps` na mesma fila, aborta os seguintes se o primeiro falhar, guarda o `providerId` do primeiro envio no destinatário e aplica jitter entre passos. Contadores de fila por mensagem física; `dsp_recipients` continua 1 linha por contato. Se o menu com mídia retornar erro de campo inválido, refaz automaticamente como dois passos e registra isso no log da campanha.
- Nenhuma migração de banco; nenhum campo novo.
- Frontend: apenas o aviso em `CampaignWizardDialog.tsx` / `TemplatePreview.tsx`.
- Redeploy de `dsp-campaign-worker`; verificação com campanha de teste de 1 número.
