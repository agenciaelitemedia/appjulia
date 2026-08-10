# Corrigir salvamento do agente + edição do modelo ZapSign + variável de data completa

## 1. Corrigir "Falha ao salvar: contract_api_token"

A migração do ZapSign (`20260809223000...`) nunca foi aplicada no banco. Confirmado agora:

- `xj_agents` **não tem** a coluna `contract_api_token` (por isso o salvamento falha).
- `xj_provider_settings` não tem a linha do provedor `zapsign` (o token padrão do escritório não é encontrado).
- `xj_contracts` não tem a coluna `template_id` (não fica registrado qual modelo gerou o contrato).

Uma migração vai aplicar exatamente essas partes que faltaram:

- `xj_agents.contract_api_token` (texto, opcional) — token do ZapSign por agente especialista.
- Liberar o tipo `contract` nas regras de `xj_provider_settings` e `xj_client_provider_keys`.
- Inserir o provedor `zapsign` (tipo `contract`) com o token padrão já usado no wizard.
- `xj_contracts.template_id` apontando para o modelo do ZapSign usado.
- Completar a tabela `xj_zapsign_templates` (criada ontem sem os vínculos) com as ligações para caso jurídico e agente.

## 2. Editar o contrato/modelo do ZapSign depois de configurado

Hoje o wizard sempre começa do zero: para mexer no mapeamento é preciso subir o `.docx` de novo.

- Na aba **Contrato** do agente, além de "Configurar modelo", aparece **"Editar mapeamento"** quando já existe modelo ativo.
- Ao abrir em modo edição, o wizard vai direto para a etapa **Variáveis**, com o modelo atual e o mapeamento já preenchidos, e mostra nome do modelo, pasta e data da última alteração.
- Continua sendo possível **substituir o modelo** (subir outro `.docx`) por um botão "Trocar arquivo", que recarrega as variáveis e preserva o mapeamento das variáveis com o mesmo nome.
- Botão para **remover** o modelo ativo do caso (desativa, não apaga histórico de contratos).

## 3. Variável de data completa no mapeamento

Nova variável "de sistema" disponível na lista de mapeamento, sem depender de dado coletado do lead:

- **Data atual completa** → resultado: `Brasília/DF, 10 de agosto de 2026`
- **Data por extenso** → resultado: `10 de agosto de 2026`

Elas aparecem no seletor de campos em um grupo separado ("Automáticas do sistema"), com uma prévia do valor atual ao lado, para ficar claro que não é um campo pedido ao lead. Não entram na checklist de campos obrigatórios do contrato.

Na hora de gerar o documento, o valor é calculado no momento do envio ao ZapSign, no horário de Brasília, com o mês em português.

## Detalhes técnicos

- **Migração**: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para `xj_agents.contract_api_token` e `xj_contracts.template_id`; recriação dos `CHECK` de `kind` incluindo `contract`; `INSERT ... ON CONFLICT DO NOTHING` do provedor `zapsign`; `ALTER TABLE public.xj_zapsign_templates ADD CONSTRAINT` para as FKs de `case_id` e `agent_id`.
- **Campos automáticos**: em `src/modules/x-julia/lib/contractFieldCatalog.ts`, adicionar as chaves `sys_data_completa` e `sys_data_extenso` com flag `computed: true`; `AgentEditorPage.tsx` filtra campos `computed` da checklist de dados obrigatórios.
- **Geração**: em `supabase/functions/_shared/x-julia/contracts.ts`, na montagem do array `data` enviado ao ZapSign, resolver chaves com prefixo `sys_` por uma função `resolveSystemField(key)` (nova, em `_shared/x-julia/datetime.ts`), usando o fuso `America/Sao_Paulo` e `Intl.DateTimeFormat('pt-BR')` para o mês; demais chaves continuam lendo `session.slots`.
- **Wizard**: `ZapSignWizardDialog.tsx` recebe `mode: 'create' | 'edit'`; em `edit` inicia em `step = 2` com `template = current`. O `saveMapping` já existente é reaproveitado; a remoção usa uma nova ação `deactivate_template` na função `xj-zapsign`.
- Após a migração, redeploy de `x-julia-engine`, `x-julia-followup-runner` e `xj-zapsign`.
