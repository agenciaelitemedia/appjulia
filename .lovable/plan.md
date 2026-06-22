## Objetivo

Criar uma nova área no projeto para abrigar funções que hoje rodam no n8n e estão sendo migradas para o sistema. A primeira função é **Followup Stop**, que para follow-ups ativos e limpa o pré-followup no banco PostgreSQL externo.

## Estrutura proposta

### 1. Pasta `supabase/functions/n8n_execute/`

Pasta dedicada às funções migradas do n8n. Cada função vive em sua própria subpasta (Edge Function própria), permitindo invocação independente e logs isolados.

```text
supabase/functions/n8n_execute/
├── README.md                    ← doc geral do grupo + índice das funções
└── followup-stop/
    └── index.ts                 ← Edge Function "Followup Stop"
```

> Observação técnica: por restrição do Supabase CLI, cada Edge Function precisa ser uma pasta direta dentro de `supabase/functions/`. Por isso o nome real da função deployada será `n8n_execute-followup-stop` (pasta `supabase/functions/n8n_execute-followup-stop/`), mas a documentação e o agrupamento lógico ficam em `supabase/functions/n8n_execute/README.md`. Se preferir outro nome de função, me avise.

### 2. Memória do projeto

Criar `mem://features/n8n-execute/index.md` como **índice** das funções migradas, e um arquivo por função (começando por `mem://features/n8n-execute/followup-stop.md`). Adicionar uma linha em `mem://index.md` apontando para o índice.

### 3. Documentação

`supabase/functions/n8n_execute/README.md` lista cada função com:
- Nome e propósito
- Parâmetros de entrada (nome, tipo, obrigatoriedade)
- Tabelas/banco afetados
- Exemplo de invocação via `supabase.functions.invoke`

## Função 1 — Followup Stop

**Propósito:** parar follow-ups ativos e impedir novos disparos para uma sessão.

**Parâmetros (JSON body):**
- `codAgent` (string, obrigatório) — código do agente
- `sessionId` (string, obrigatório) — número WhatsApp da sessão (qualquer formato; será normalizado)

**Normalização do telefone BR:**
Usa `_shared/phone-normalize.ts` (`brPhoneVariants`) para gerar as duas formas:
- `phone13` — 13 dígitos (com o 9º)
- `phone12` — 12 dígitos (sem o 9º)

Ambas vão na cláusula `IN (...)` para tolerar DDDs ≥ 30 (sem 9) e < 30 (com 9), conforme regra do projeto.

**Banco:** PostgreSQL externo, acessado via Edge Function `db-query` (padrão do projeto — ver `mem://technical/edge-functions/external-db-connection-logic`). Será adicionada uma nova `action: 'followup_stop'` no `db-query/index.ts` que executa as 3 queries dentro de uma transação:

```sql
-- 1) Limpar pré-followup
DELETE FROM public.followup_queue_temp
WHERE cod_agent = $1
  AND session_id = ANY($2);   -- [phone13, phone12]

-- 2) Parar follow-ups ativos
UPDATE public.followup_queue
SET state = 'STOP',
    send_date = (now() - INTERVAL '3 hours')
WHERE state = 'SEND'
  AND name_client = $1
  AND session_id = ANY($2);

-- 3) Limpar status de processamento
DELETE FROM public.agent_processing_status
WHERE cod_agent = $1
  AND session_id = ANY($2);
```

Retorno: `{ data: { deleted_temp, updated_queue, deleted_status, phones: [phone13, phone12] }, error: null }`.

**Edge Function `n8n_execute-followup-stop/index.ts`:**
- Valida body com Zod (`codAgent` non-empty, `sessionId` non-empty).
- Normaliza telefone e chama `db-query` com `action: 'followup_stop'`.
- Retorna 200 com totais, ou 400/500 com mensagem clara.
- CORS padrão do projeto.
- `verify_jwt = false` em `supabase/config.toml` (consistente com `db-query` e demais utilitários de backend).

## Atualizações de memória

- `mem://index.md` — adicionar linha na seção Memories: `- [n8n Execute](mem://features/n8n-execute/index) — Funções migradas do n8n para Edge Functions`.
- `mem://features/n8n-execute/index.md` — índice das funções migradas (lista + link para cada arquivo).
- `mem://features/n8n-execute/followup-stop.md` — descrição completa de Followup Stop (parâmetros, normalização BR, 3 queries, tabelas, retorno).

## Fora de escopo

- Nenhuma alteração no fluxo atual do n8n; a função nova é independente. A migração do gatilho (quem chama no lugar do n8n) será tratada em outro pedido.
- Sem migração de schema — todas as tabelas (`followup_queue_temp`, `followup_queue`, `agent_processing_status`) já existem no banco externo.
