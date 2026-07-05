## Diagnóstico

Consultei o banco e os logs:

- `wavoip-transcribe-recording` **nunca foi invocada** (zero logs).
- Existem **3 chamadas** com `recording_status='available'` e `transcription_status='pending'` — travadas mostrando o spinner "Transcrevendo…" pra sempre.

Causa raiz: o disparo automático foi adicionado dentro de `wavoip-fetch-recording`, então só roda quando uma gravação **nova** fica disponível. As gravações que já existiam antes do deploy nunca disparam a transcrição, e a UI trata `pending` como "em processamento" (ícone spinner, botão desabilitado), então o usuário também não consegue clicar pra iniciar.

## Correção

### 1. `TranscriptionButton.tsx` — tornar `pending` acionável

Hoje o status `pending` cai no ramo "Transcrevendo…" (spinner + `disabled=true`). Vou separar:

- `pending` **com** gravação disponível + plano ativo → ícone `FileText` normal, tooltip "Iniciar transcrição", clique invoca `wavoip-transcribe-recording` (mesmo fluxo do retry de `failed`).
- `processing` → continua como spinner desabilitado (esse sim é estado real de execução na edge function).
- Também corrijo o bug da condição do spinner (`|| status === 'pending' && hasRecording && planAllowsTranscription` está com precedência errada — hoje mostra spinner mesmo quando não deveria).

### 2. Auto-dispatch on mount para itens visíveis

No `CallHistoryTab.tsx`, quando a linha renderizar com `recording_status='available'`, `transcription_status='pending'` e plano permitido, disparar 1x (com dedupe via `Set` de IDs já enviados nesta sessão) a invocação de `wavoip-transcribe-recording`. Isso resolve backfill sem depender de cron nem exigir clique manual.

### 3. Edge function `wavoip-transcribe-recording` — idempotência de concorrência

Como o disparo pode acontecer ao mesmo tempo por várias abas, adicionar guarda logo após carregar o log: se `transcription_status='processing'` **e** `!force`, retornar `{ok:false, reason:'already_processing'}` sem reprocessar. Evita chamadas duplicadas ao STT (custo).

## Fora de escopo

- Cron sweeper (a combinação clique + auto-dispatch on mount cobre 100% dos casos visíveis).
- Retry automático de `failed` (segue manual via clique, como já está).

## Arquivos alterados

- `src/pages/wavoip/components/TranscriptionButton.tsx` — lógica de estados + handler pra `pending`.
- `src/pages/wavoip/components/CallHistoryTab.tsx` — efeito de auto-dispatch para linhas pendentes.
- `supabase/functions/wavoip-transcribe-recording/index.ts` — guarda de `already_processing`.
