## Objetivo

Adicionar um novo assistente de IA — **Avaliador de Atendimento** — no sistema, configurável em `/configuracoes` → aba **IA's** junto aos demais (AIAssistPanel, Copiloto CRM, Copiloto Chat). Além disso, permitir em **todos** os cards de IA visualizar e editar o **prompt** utilizado por cada assistente, via um ícone ao lado do seletor de modelo.

O plano será salvo em `.lovable/plans/avaliador-atendimento.md` para execução futura.

---

## 1. Novo assistente: Avaliador de Atendimento

### O que faz
Avalia uma conversa de atendimento (chat Julia) e retorna:
- **Nota geral** (0–10) e classificação (Excelente / Bom / Regular / Ruim)
- **Sentimento do lead** (positivo / neutro / negativo / frustrado) com justificativa
- **Avaliação do atendente**: cordialidade, clareza, tempo de resposta, aderência ao roteiro
- **Pontos fortes** do atendimento (bullets)
- **Pontos de melhoria** (bullets acionáveis)
- **Problema resolvido?** (sim / parcialmente / não)
- **Resumo executivo** (2-3 linhas)
- Tags sugeridas (ex.: "follow-up necessário", "lead qualificado", "reclamação")

### Onde fica disponível
- **Painel de IA do Chat** (`AIAssistPanel`): botão **"Avaliar Atendimento"** ao lado de "Gerar Resumo".
- **CRM (detalhes do lead)**: aba ou botão para avaliar a conversa vinculada.
- **Histórico** persistido em nova tabela `chat_evaluations` (uma por execução, com timestamps e modelo usado), para listar/comparar avaliações ao longo do tempo.

### Backend
- Estender `supabase/functions/chat-ai-assist/index.ts` com novo `mode: "agent_evaluation"`.
- Usar **AI SDK + Lovable AI Gateway** (`Output.object` com schema Zod) em vez de parse manual de JSON.
- Resolver modelo via nova feature `evaluator` em `client_ai_model_config` (default `google/gemini-2.5-flash`).
- Resolver **prompt** via nova tabela `client_ai_prompts` (fallback para prompt padrão hardcoded se não houver override).

---

## 2. Configurações de IA's — prompts editáveis

### UI (`AIModelsConfig.tsx`)
- Em cada `FeatureCard`, adicionar ícone **`FileText`** (botão fantasma) ao lado do `Select` de modelo.
- Clique abre `Dialog` "Prompt do assistente" com:
  - `Textarea` grande (min-h 400px, monospace) com o prompt atual.
  - Badge mostrando se é "Padrão do sistema" ou "Personalizado".
  - Botões: **Salvar**, **Restaurar padrão**, **Cancelar**.
  - Hint listando placeholders disponíveis (ex.: `{{transcript}}`, `{{client_name}}`).
- Adicionar 4º card: **Avaliador de Atendimento** (`feature: "evaluator"`), ícone `ClipboardCheck`.

### Backend / dados
- Nova tabela `client_ai_prompts`:
  ```
  id uuid pk
  client_id text not null
  feature text not null  -- chat_assist | copilot_crm | copilot_chat | evaluator | (sub-modos)
  mode text              -- opcional: summary | suggest | sentiment | full_summary | agent_evaluation
  prompt text not null
  updated_at timestamptz default now()
  unique(client_id, feature, mode)
  ```
- RLS: leitura/escrita restrita ao `client_id` do usuário autenticado (via `has_role` / claim padrão do projeto).
- Hook `useAIPrompts(feature, mode?)` → `{ prompt, isCustom, save, reset }`.
- Edge functions (`chat-ai-assist`, `chat-ai-process`, copiloto): buscar prompt via helper `getPrompt(clientId, feature, mode)` com fallback ao default.

### Prompts padrão a expor
Cada modo do `chat-ai-assist` vira uma entrada editável separada:
- `chat_assist / summary`
- `chat_assist / suggest`
- `chat_assist / sentiment`
- `chat_assist / full_summary`
- `evaluator / agent_evaluation` (novo)
- `copilot_crm` (genérico, do copiloto CRM)
- `copilot_chat` (genérico)

No diálogo de prompt usar `Tabs` para alternar entre os modos quando o card tiver múltiplos prompts (ex.: AIAssistPanel terá 4 abas).

---

## 3. Detalhes técnicos

### Migração SQL (resumo)
```sql
create table public.client_ai_prompts (...);
alter table public.client_ai_prompts enable row level security;
create policy "client_select" on public.client_ai_prompts for select
  using (client_id = current_setting('request.jwt.claims', true)::json->>'client_id');
-- idem insert/update
create table public.chat_evaluations (
  id uuid pk default gen_random_uuid(),
  client_id text not null,
  conversation_id text not null,
  agent_id bigint,
  score numeric(3,1),
  classification text,
  sentiment text,
  resolved text,
  strengths jsonb,
  improvements jsonb,
  summary text,
  tags text[],
  model text,
  created_by uuid,
  created_at timestamptz default now()
);
-- index (client_id, conversation_id, created_at desc)
```

### Edge function `chat-ai-assist` — novo modo
- Adicionar `"agent_evaluation"` em `validModes`.
- Carregar até 200 mensagens (mesmo padrão de `full_summary`).
- Usar `generateText({ model, output: Output.object({ schema }) })` com schema Zod descrevendo todos os campos.
- Persistir resultado em `chat_evaluations` antes de retornar.
- Tratar 429/402 com mensagens já padronizadas no arquivo.

### Frontend — botão "Avaliar Atendimento"
- Em `AIAssistPanel`: novo botão (`ClipboardCheck`) que chama `supabase.functions.invoke("chat-ai-assist", { body: { mode: "agent_evaluation", conversation_id, client_id }})`.
- Resultado renderizado em card colapsável com: nota grande, badges (classificação, sentimento, resolução), seções de pontos fortes/melhorias, tags.
- Componente `ConversationEvaluations` (similar a `ConversationSummaries`) listando avaliações históricas.

### Componente reutilizável `PromptEditorDialog`
Props: `feature`, `mode?`, `defaultPrompt`, `placeholders[]`. Encapsula fetch/save/reset e tabs.

---

## 4. Entregáveis / arquivos esperados

- `supabase/migrations/<ts>_ai_prompts_and_evaluations.sql`
- `supabase/functions/chat-ai-assist/index.ts` (estender com `agent_evaluation` + leitura de prompt da tabela)
- `supabase/functions/_shared/ai-prompts.ts` (helper `getPrompt`)
- `src/hooks/useAIPrompts.ts`
- `src/hooks/useChatEvaluations.ts`
- `src/components/ai/PromptEditorDialog.tsx`
- `src/pages/configuracoes/components/AIModelsConfig.tsx` (4º card + ícone prompt)
- `src/hooks/useAIModelsConfig.ts` (adicionar `evaluator` em `AIFeature` e `DEFAULT_MODELS`)
- `src/components/chat/AIAssistPanel.tsx` (botão Avaliar + render do resultado)
- `src/components/chat/ConversationEvaluations.tsx`
- Integração opcional no CRM (botão na sidebar de detalhes do lead)

---

## 5. Aceite / QA

- /configuracoes → IA's mostra 4 cards (incluindo Avaliador), cada um com ícone de prompt funcional.
- Editar prompt salva por cliente, "Restaurar padrão" volta ao hardcoded.
- No chat: botão "Avaliar Atendimento" retorna avaliação estruturada e persiste histórico.
- Avaliação reflete o prompt customizado quando alterado.
- Erros 429/402 aparecem como toast amigável.
- RLS impede um cliente ver prompts/avaliações de outro.

---

## 6. Salvar plano

Gravar este documento em `.lovable/plans/avaliador-atendimento.md` na execução para servir de referência futura.
