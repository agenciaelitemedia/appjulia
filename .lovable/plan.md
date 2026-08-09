# X-Julia: dados coletados, custo por sessão e catálogo de modelos

Três ajustes no módulo X-Julia.

## 1. Dados coletados: nome e caso jurídico sempre visíveis

Hoje o card "Dados coletados" mostra o conteúdo cru de `slots` (inclusive chaves internas como `__restarted_at`) e nada garante que o primeiro nome pedido na recepção fique gravado.

- No prompt do agente: regra explícita de que, ao obter o nome na abertura, ele deve chamar `registrar_dados` gravando `nome` (primeiro nome) e `nome_completo` quando houver.
- Na skill `registrar_dados`: sempre que vier um nome, derivar e gravar o slot `nome` (primeiro nome), além de atualizar `contact_name`.
- Na skill `identificar_caso`: gravar também o slot `caso_juridico` com o nome do caso reconhecido (hoje só grava em `case_type`).
- Na tela do atendimento: mostrar primeiro "Nome" e "Caso jurídico" em destaque, rótulos legíveis para as demais chaves e ocultar chaves internas (prefixo `__`).

## 2. Tokens e custo gravados na sessão

- Migration: adicionar em `xj_sessions` as colunas `prompt_tokens`, `completion_tokens`, `total_tokens` (integer, default 0) e `cost_usd` (numeric, default 0); em `xj_session_events`, `cost_usd` (numeric).
- No motor: a cada chamada de LLM, calcular o custo pelo modelo usado, somar nos totais da sessão e gravar o custo do evento individual.
- Tabela de preços por modelo (US$ por 1 milhão de tokens de entrada/saída) em arquivo compartilhado, com fallback neutro para modelo desconhecido (custo 0, sem quebrar o turno).
- Na tela do atendimento: bloco "Consumo" com turnos, tokens de entrada/saída, total e custo acumulado (US$ e R$ estimado); na lista de sessões, coluna de custo.

## 3. Informações e custo do modelo na configuração do provedor

- Enriquecer o catálogo de modelos (front e motor) com: descrição curta de uso, janela de contexto, preço de entrada e de saída por 1M tokens e indicação de geração atual.
- Em Configuração do X-Julia (provedores), cada modelo passa a exibir preço in/out e contexto ao lado do nome, com legenda da unidade.
- No editor do agente, o seletor de modelo exibe preço e descrição do modelo selecionado, ajudando a escolher entre qualidade e custo.

## Detalhes técnicos

- Migration nova em `supabase/migrations/` (apenas `ADD COLUMN IF NOT EXISTS`; sem mexer em RLS existente).
- Novo `supabase/functions/_shared/x-julia/pricing.ts` com catálogo de preços e `estimateCost(provider, model, promptTokens, completionTokens)`.
- `runner.ts`: após cada `xjComplete`, incrementar contadores na sessão (`updateSession`) e enviar `cost_usd` no `logXJEvent`.
- `skills.ts`: ajustes em `registrar_dados` e `identificar_caso`; `prompt.ts`: regra de coleta de nome e exibição dos slots já coletados.
- `src/modules/x-julia/module.ts`: `XJ_LLM_PROVIDERS` ganha metadados por modelo (preço/contexto/descrição), mantendo `models: string[]` derivado para não quebrar telas atuais.
- Telas afetadas: `SessionDetailPage.tsx`, `SessionsManagePage.tsx`/`SessionsPage.tsx`, `SettingsPage.tsx`, `AgentEditorPage.tsx`.
- Sem alterar o formato de `slots` existente: apenas novas chaves; nada é removido.