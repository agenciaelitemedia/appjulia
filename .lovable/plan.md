# Ajustes na IA de transcrição e resumo Wavoip

## Contexto
Já existem dois agentes separados em `/configuracoes` (`wavoip_transcription` e `wavoip_call_summary`), cada um com seu próprio seletor de modelo e prompt. O problema atual é na edge function `wavoip-transcribe-recording`: ela roda uma etapa intermediária de "reescrita" da transcrição com um modelo **hardcoded** (`google/gemini-2.5-flash`), o que ignora a seleção do usuário e pode inventar/alterar conteúdo antes de chegar ao resumo.

## O que mudar

### 1. `supabase/functions/wavoip-transcribe-recording/index.ts`
- **Remover a etapa de "reescrita via chat"** (`callChat` com `google/gemini-2.5-flash`). A transcrição salva passa a ser exatamente o texto retornado pelo STT (`rawText`), sem passar por outro LLM. Assim nenhum modelo intermediário inventa fala.
- O prompt do STT (`wavoip_transcription`) continua responsável por instruir formato `Atendente:/Cliente:`. O modelo STT pode ser trocado livremente em `/configuracoes`.
- **Resumo** passa a receber estritamente `transcription_text` como única fonte, e o prompt padrão será reforçado com regra explícita de "não inventar / usar apenas o que estiver na transcrição / se não houver informação suficiente, dizer isso".
- Usar o modelo/prompt configurado em `wavoip_call_summary` (já é assim); nada hardcoded.

### 2. `src/hooks/useAIModelsConfig.ts`
- Atualizar `DEFAULT_PROMPTS.wavoip_transcription`: manter formato de diálogo, mas reforçar "transcreva literalmente, não parafraseie, não invente, use `[trecho inaudível]` quando não entender".
- Atualizar `DEFAULT_PROMPTS.wavoip_call_summary`: adicionar "baseie-se EXCLUSIVAMENTE na transcrição fornecida abaixo; não invente fatos, nomes, valores ou compromissos; se a transcrição for muito curta ou incompleta, diga isso em vez de preencher".

### 3. UI `/configuracoes` (AIModelsConfig.tsx)
- Nenhuma mudança estrutural — os dois cards já existem e permitem escolher modelo e editar prompt separadamente. Apenas ajustar as `description` para deixar claro:
  - Transcrição: "Modelo de STT (áudio→texto). Escolha um modelo de transcrição (ex.: `openai/gpt-4o-mini-transcribe`)."
  - Resumo: "Modelo de chat que resume a transcrição já gerada. Opere apenas sobre o texto transcrito — não recebe o áudio."

## Fora de escopo
- Retranscrever chamadas já processadas (usuário pode clicar em "Regerar" quando quiser).
- Mudanças na tabela de features do plano.

## Arquivos afetados
- `supabase/functions/wavoip-transcribe-recording/index.ts`
- `src/hooks/useAIModelsConfig.ts`
- `src/pages/configuracoes/components/AIModelsConfig.tsx` (apenas textos de descrição)
