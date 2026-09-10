# Disparos: prévia única e limite diário ajustável

## 1. Por que a prévia aparece repetida

Na última etapa do assistente, a tela mostra uma amostra dos **5 primeiros contatos** da lista.
Como quase sempre existe só uma variante de mensagem, os 5 blocos trazem exatamente o mesmo
texto — parece duplicado, mas são 5 destinatários diferentes com a mesma mensagem.

**Ajuste:** mostrar **uma prévia por variante de mensagem** (com uma variante = 1 bloco só),
identificando a variante e informando para quantos contatos ela vale.

## 2. Por que a capacidade está em 60 e como subir para 120

A capacidade do dia é calculada como *limite liberado hoje* menos *o que já foi enviado hoje*.
O "limite liberado hoje" vem do aquecimento (rampa) do número: no primeiro dia ele libera uma
fração do teto configurado (teto 300, rampa 50% → 60 hoje) e cresce nos dias seguintes.
Hoje não existe forma de alterar isso pela tela — o valor fica travado até o dia seguinte.

**Ajuste:** no cartão de cada número (aba Canais) entra um campo **"Liberado para hoje"**,
editável, com botão Salvar. Digitando 120 e salvando, a campanha passa a considerar 120 hoje.
O campo respeita o teto configurado do tipo de conexão (se o teto for 300, aceita até 300) e
mostra um aviso curto: aumentar muito de uma vez em número não oficial aumenta risco de bloqueio.
A alteração permanente do teto e da rampa continua na aba Configurações.

## Detalhes técnicos

- `src/modules/disparos/components/CampaignWizardDialog.tsx`: renderizar `sim.preview`
  agrupado/deduplicado por variante (uma linha por texto distinto), mantendo o telefone de exemplo.
- `supabase/functions/dsp-campaign-prepare/index.ts`: no bloco `dry_run`, gerar `preview` com um
  registro por `variant_id` (em vez de `rows.slice(0, 5)`), incluindo `variant_label` e a contagem
  de destinatários daquela variante.
- `src/modules/disparos/components/ChannelLimitsCard.tsx`: novo input numérico
  `allowed_today` (valor atual de `dsp_channel_state.allowed_today`, fallback = cálculo da rampa)
  + botão Salvar.
- `src/modules/disparos/hooks/useDspLimits.ts`: nova mutation `useSaveChannelAllowedToday`
  atualizando `dsp_channel_state.allowed_today` por `queue_id`, com clamp entre 1 e
  `profile.max_per_day`, e invalidação das queries de estado dos canais.
- Nenhuma mudança em `dsp-core.ts`: `effectiveDailyLimit` já usa `allowed_today` limitado por
  `max_per_day`.
- Sem migração de banco: as colunas já existem.
