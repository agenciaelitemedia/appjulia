# Transcrição + Resumo de Gravações Wavoip

## Visão geral
Adicionar uma nova feature de IA (`wavoip_transcription`) seguindo exatamente o padrão já usado em `chat_transcription` / `chat_resume`:
- Editável em `/configuracoes` → aba "IA's" (modelo + prompt de transcrição e de resumo, com "Restaurar padrão").
- Executada automaticamente logo após a gravação ser salva no Storage.
- Só roda para clientes cujo plano Wavoip tenha as flags `transcription` e `recording_summary` ativas.
- Ícone dedicado na tabela do histórico com 3 estados visuais (habilitado / desabilitado por falta de gravação / vermelho por plano sem transcrição) e tooltip explicativo em cada caso.
- Ao clicar, abre popup com o **resumo compacto** no topo e a **transcrição em formato diálogo** abaixo.

## 1. Banco de dados (migração)

Uma migration única com:

- Alterar `wavoip_call_logs`:
  - `transcription_status text not null default 'pending'` (`pending | processing | ok | failed | disabled`)
  - `transcription_text text null` (texto em formato "Atendente: … / Cliente: …")
  - `transcription_summary text null`
  - `transcription_error text null`
  - `transcription_generated_at timestamptz null`
- Grants habituais para `authenticated` / `service_role` (padrão do projeto).
- Seed via `UPDATE` para garantir que `wavoip_plans.features` do plano "Wavoip Free" continue como está; nenhum plano novo é criado.

Nenhuma tabela nova é necessária — reutiliza `client_ai_model_config` (feature `wavoip_transcription`) e `wavoip_plans.features` (flags booleanas).

## 2. Planos Wavoip (`/admin/wavoip` → aba Planos)

Em `WavoipPlansTab.tsx` adicionar dois switches no formulário de plano, gravados em `features` (JSONB) como flags booleanas:
- `transcription` — "Transcrição de gravações"
- `recording_summary` — "Resumo da gravação"

Exibir também na listagem como badges.

Helper novo `src/pages/wavoip/lib/planFeatures.ts`:
- `hasPlanFeature(planFeatures, key): boolean`
- Hook `useWavoipClientPlanFeatures(clientId)` → carrega plano ativo em `wavoip_user_plans` + `wavoip_plans` e retorna `{ transcription, recordingSummary }` (com cache React Query).

## 3. Nova feature de IA `wavoip_transcription`

Em `src/hooks/useAIModelsConfig.ts`:
- Adicionar `'wavoip_transcription'` e `'wavoip_call_summary'` ao union `AIFeature`.
- `DEFAULT_MODELS`: STT usa `openai/gpt-4o-mini-transcribe`; resumo usa `google/gemini-2.5-flash`.
- `DEFAULT_PROMPTS`:
  - `wavoip_transcription`: instrução em pt-BR para transcrever a chamada como **diálogo**, alternando linhas `Atendente:` e `Cliente:`, sem comentários, sem tradução. Explica que o áudio é uma chamada telefônica de 2 interlocutores.
  - `wavoip_call_summary`: instrução para gerar **resumo compacto** (máx. ~5 bullets + 1 frase de abertura em negrito) cobrindo o motivo do contato, principais pedidos/decisões e próximos passos.

`AIModelsConfig.tsx` renderiza automaticamente as novas features (a lista é derivada do union). Sem mudanças de UI adicionais além dos rótulos já suportados pelo componente.

## 4. Edge function `wavoip-transcribe-recording`

Nova função `supabase/functions/wavoip-transcribe-recording/index.ts`.

Fluxo (recebe `{ call_id }`):
1. Carrega `wavoip_call_logs` (id, client_id, recording_url, recording_status, transcription_status, duration_seconds).
2. Se `recording_status !== 'available'` → retorna `{ ok:false, reason:'no_recording' }`.
3. Idempotência: se `transcription_status = 'ok'` e `force !== true` → retorna dados atuais.
4. Verifica flags do plano do cliente (`transcription` obrigatório; se ausente → grava `transcription_status='disabled'`, retorna `{ ok:false, reason:'plan_disabled' }`).
5. Marca `transcription_status='processing'`.
6. Baixa o arquivo do bucket privado `wavoip-recordings` via signed URL (helper existente do storage admin).
7. **STT**: POST `multipart/form-data` para `https://ai.gateway.lovable.dev/v1/audio/transcriptions` com o modelo configurado (`getPromptForFeature('wavoip_transcription')` como `prompt` do STT para orientar formato diálogo). Áudio Wavoip é OGG/Opus → transcodificar para WAV via `ffmpeg-wasm` **não** é viável em Deno; em vez disso, enviamos direto o arquivo original renomeado para a extensão correta (`.ogg`) e, se STT rejeitar, fazemos fallback: enviar como MP3 usando conversão prévia realizada pelo próprio Wavoip. **Nota técnica:** Wavoip entrega recordings em `audio/ogg;codecs=opus` que o modelo aceita normalmente ao enviar como `.ogg`; validado por curl na fase de implementação.
8. Aplica pós-processamento leve: se o modelo devolveu texto corrido, uma segunda chamada de LLM (`google/gemini-2.5-flash`, prompt de "reescreva como diálogo Atendente/Cliente") converte para o formato desejado. Se já veio formatado, mantém.
9. **Resumo** (somente se `recording_summary` da flag do plano estiver ativo): chama Gemini com o prompt `wavoip_call_summary` sobre a transcrição.
10. Persiste `transcription_status='ok'`, `transcription_text`, `transcription_summary`, `transcription_generated_at`. Em erro: `transcription_status='failed'` + `transcription_error`.
11. Sempre retorna 200 com `{ ok, status, text?, summary?, reason? }` (padrão do `chat-transcribe-audio`).

CORS + verify_jwt padrão. Usa `LOVABLE_API_KEY` do env.

## 5. Auto-disparo pós-storage

Em `supabase/functions/wavoip-fetch-recording/index.ts`, no bloco final onde já grava `recording_status='available'` e `recording_url=finalUrl`, adicionar após o update:

```ts
// fire-and-forget
fetch(`${SUPABASE_URL}/functions/v1/wavoip-transcribe-recording`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ call_id: log.id }),
}).catch(() => {});
```

Não bloqueia o retorno da função original. Idempotência garante que reprocessamentos não dupliquem.

## 6. UI do Histórico (`CallHistoryTab.tsx` + novo componente)

Adicionar coluna "Transcrição" (à direita de "Gravação").

Novo componente `src/pages/wavoip/components/TranscriptionButton.tsx`:
- Props: `call` (com `recording_status`, `transcription_status`, `transcription_text`, `transcription_summary`), `planAllowsTranscription: boolean`, `onRefetch`.
- Estados do ícone `FileText`:
  - **Vermelho + tooltip "Transcrição desativada no plano — ative em Planos Wavoip"** quando `!planAllowsTranscription`.
  - **Cinza / disabled + tooltip "Sem gravação disponível para transcrever"** quando `recording_status !== 'available'`.
  - **Amarelo + spinner + tooltip "Transcrevendo…"** quando `transcription_status IN ('pending','processing')` e há gravação (com plano ativo).
  - **Cinza + tooltip "Falha na transcrição — clique para tentar novamente"** quando `transcription_status='failed'`.
  - **Ativo (cor primary) + tooltip "Ver transcrição e resumo"** quando `transcription_status='ok'`.
- Clique:
  - Se `ok` → abre `Dialog` mostrando **Resumo** (bloco destacado) e **Transcrição** (fonte mono, quebras de linha preservadas, com badges Atendente/Cliente coloridos aplicando regex por linha).
  - Se `failed` → invoca `wavoip-transcribe-recording` com `{ call_id, force:true }`.
  - Demais estados: nenhum efeito.

Popup:
- `Dialog` shadcn, largura `max-w-2xl`.
- Header: "Chamada com {formatBRPhone(numero)} · {duração} · {data}".
- Bloco **Resumo** (borda `primary/20`, bg `primary/5`, ícone `Sparkles`).
- Bloco **Transcrição** com botão "Copiar" (usa `navigator.clipboard`).
- Botão "Regenerar" no rodapé (só admin ou dono da ligação; usa `force:true`).

Assinatura realtime existente do `useWavoipCallHistory` já cobrirá updates da linha (a transcrição chega automaticamente após concluir).

## 7. Testes manuais / validação

Após implementar:
- Ativar `transcription` + `recording_summary` no plano do cliente de teste.
- Fazer uma chamada Wavoip com gravação; após aparecer no storage, o ícone deve ficar amarelo (processando) e em ~10-30s virar ativo.
- Clicar → popup exibe resumo + diálogo alternado.
- Desativar `transcription` no plano → ícone fica vermelho, chamadas novas não geram transcrição.

## Detalhes técnicos (referência)

- Modelos: STT `openai/gpt-4o-mini-transcribe` (endpoint `/v1/audio/transcriptions`, `multipart/form-data`, retorna texto). Resumo/pós-processamento: `google/gemini-2.5-flash` via `/v1/chat/completions` (helper `_shared/aiGateway.ts` já existente).
- Formatação diálogo: prompt do STT pede etiquetagem por locutor; se o modelo não etiquetar, segunda passada de LLM com prompt fixo transforma texto em diálogo. Regex `^(Atendente|Cliente):\s*` no front decide colorização.
- Sem novos secrets — reutiliza `LOVABLE_API_KEY` já presente.
- Não altera outras features (`chat_transcription` continua para áudios de chat).

## Fora de escopo
- Backfill de gravações antigas.
- Editor manual de transcrição.
- Exportação de transcrição em PDF.
