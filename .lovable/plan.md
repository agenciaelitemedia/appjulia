
## Contexto

Tela `/admin/prompts` → "Visualizar prompt do agente" exibe o prompt final gerado. Hoje mostra link de assinatura do ZapSign de forma incompleta. Falta também botão para publicar o prompt diretamente no banco externo (tabela `agents`, coluna `prompt`) do `cod_agent` correspondente.

## Investigação necessária (rápida, antes de implementar)

1. Encontrar o componente de visualização do prompt em `src/pages/admin/prompts/` (provavelmente um `ViewPromptDialog` ou similar) — ver onde o link ZapSign é renderizado hoje.
2. Confirmar formato esperado do link: `https://app.zapsign.com.br/verificar/doc/{zapsign_doc_token}`. Os tokens já estão em `generation_agent_prompt_cases.zapsign_doc_token`.
3. Confirmar que `externalDb.updateAgent(agentId, { prompt })` aceita atualizar somente o campo `prompt` (já existe em `useAgentUpdate.ts`).
4. Verificar como obter `agent_id` (numérico do banco externo) a partir do `cod_agent` da tabela `generation_agent_prompts` — provavelmente via `externalDb.getAgentByCodAgent(cod_agent)`.

## Plano

### 1. Ajuste do link ZapSign (visualização)
No componente de visualização do prompt do agente, onde os casos são renderizados, substituir/exibir o link como:
```
https://app.zapsign.com.br/verificar/doc/{zapsign_doc_token}
```
- Renderizar como `<a target="_blank">` clicável.
- Se `zapsign_doc_token` estiver vazio, ocultar o link.

Adicionalmente, no motor de substituição de placeholders do prompt final (`processFinalPrompt` em `promptDefaults.ts`), garantir que o placeholder de link de verificação ZapSign seja resolvido para essa URL completa (caso seja usado dentro do texto do prompt). Verificar nomes de placeholders existentes antes de tocar.

### 2. Botão "Publicar" ao lado do "Copiar"
No componente que mostra o prompt final (provavelmente `StepFinalPrompt.tsx` ou um `ViewPromptDialog`):

- Adicionar botão **Publicar** (variant default, ícone `Upload` ou `Send`) ao lado do botão **Copiar**.
- Ao clicar → abrir `AlertDialog` de confirmação:
  > "Publicar este prompt no agente {cod_agent}? Esta ação substituirá o prompt atual do agente em produção."
- Ao confirmar:
  1. Buscar `agent_id` numérico via `externalDb.getAgentByCodAgent(cod_agent)`.
  2. Chamar `externalDb.updateAgent(agentId, { prompt: generatedPrompt })`.
  3. Registrar no Supabase em `generation_agent_prompts` (novos campos abaixo): `prompt_published_at = now()` e `prompt_published_by = userName/userId`.
  4. Opcional: log em `agent_change_log` (action: `prompt_publish`, change_summary: "Prompt publicado via Gerador de Prompt").
  5. Toast de sucesso.

### 3. Schema — 2 novos campos
Migration em `generation_agent_prompts` (Supabase):
```sql
ALTER TABLE public.generation_agent_prompts
  ADD COLUMN prompt_published_at timestamptz NULL,
  ADD COLUMN prompt_published_by text NULL;
```
- `prompt_published_at`: data/hora da última publicação.
- `prompt_published_by`: nome do usuário que publicou (texto, mesmo padrão de `created_by`/`updated_by` já usado).

Atualizar `AgentPrompt` interface em `useAgentPrompts.ts` com os dois campos opcionais e expor função `markAsPublished(id, userName)` que faz o `UPDATE`.

### 4. UI — exibir status de publicação
No header da visualização do prompt, mostrar badge:
- "Nunca publicado" (cinza) se `prompt_published_at` for nulo.
- "Publicado em {data} por {user}" (verde) caso contrário.

## Arquivos a editar
- `src/pages/admin/prompts/components/wizard/StepFinalPrompt.tsx` — botão Publicar + confirmação + badge de status (precisa receber `codAgent` e `publishedAt/publishedBy` via props).
- Componente "Visualizar" do prompt (a confirmar localização) — renderizar links ZapSign completos.
- `src/pages/admin/prompts/hooks/useAgentPrompts.ts` — adicionar campos na interface + `markAsPublished()`.
- `src/pages/admin/prompts/constants/promptDefaults.ts` — garantir placeholder ZapSign resolve para URL completa.
- Migration SQL — adicionar 2 colunas em `generation_agent_prompts`.

## Validação
1. Abrir visualizar de um prompt que tenha caso com `zapsign_doc_token` → link aparece como `https://app.zapsign.com.br/verificar/doc/{token}` e abre em nova aba.
2. Clicar "Publicar" → modal de confirmação aparece.
3. Confirmar → prompt salvo em `agents.prompt` no banco externo para o `cod_agent` correto.
4. Banner muda para "Publicado em DD/MM/AAAA HH:mm por {nome}".
5. Reabrir visualização: status persiste.
6. Cancelar confirmação → nada é alterado.
