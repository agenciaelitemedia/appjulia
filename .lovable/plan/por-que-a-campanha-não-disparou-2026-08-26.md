# Por que a campanha não disparou

## Diagnóstico (confirmado nos dados)

A campanha está correta e a fila de envio existe — o envio está **apenas aguardando o horário permitido do canal**.

- Existe 1 item na fila (`dsp_message_queue`) com status `pending`, 0 tentativas, sem lock.
- O último erro registrado é: `no_channel_available: { "<fila>": "outside_channel_window" }`.
- O padrão seguro global do provedor `uazapi` (`dsp_provider_defaults`) tem janela **08:00–20:00** (America/Sao_Paulo).
- Agora são **05:09** em São Paulo → fora da janela do canal, então o worker pula o item a cada minuto sem enviar.
- A janela da campanha (04:00–20:00) é mais ampla que a do canal, e o worker aplica a mais restritiva (a do canal). Por isso a campanha aparece "Em execução" com 0 enviados.

Ou seja: não há bug. O disparo começa automaticamente às 08:00 (SP), sem nenhuma ação necessária.

## Opções (escolha uma)

1. **Não fazer nada** — o worker envia sozinho a partir das 08:00.
2. **Ampliar a janela do provedor UaZapi** em `/disparos` → Configurações → Padrões seguros (ex. 04:00–20:00) para que a campanha comece já.
3. **Melhoria de UX (recomendada)**: exibir no card da campanha e no monitoramento o motivo real da espera — badge "Aguardando janela do canal (08:00–20:00)" quando a fila estiver pendente com `outside_channel_window`, em vez de só mostrar "Em execução · Enviados: 0".

## Detalhes técnicos da opção 3

- `src/modules/disparos/components/CampaignsTab.tsx`: no card, quando `status === 'running'` e existir item pendente com motivo `outside_channel_window`, mostrar badge de espera com a janela efetiva do canal.
- Fonte do motivo: `dsp_message_queue.last_error` (já gravado pelo worker) + janela vinda de `dsp_provider_defaults` / vínculo do canal.
- Novo hook leve `useDspWaitReason(clientId, campaignId)` em `src/modules/disparos/hooks/` lendo `dsp_message_queue` (status `pending`, `last_error ilike 'no_channel_available%'`).
- Nenhuma mudança em Edge Function ou schema; apenas leitura e apresentação.
