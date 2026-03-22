
Objetivo
- Corrigir o filtro do seletor de usuário no “Novo Ramal” para não exibir quem já possui ramal.
- Garantir que “Criar ramal” realmente crie na Api4Com e persista no banco todas as informações relevantes (incluindo email, senha gerada e payload de retorno).

Diagnóstico (estado atual)
- O filtro já existe em `RamalDialog.tsx`, mas há comparação mista de tipos (`string` vs `number`) em IDs, o que permite usuários já vinculados aparecerem no dropdown.
- O fluxo de criação está dividido: a função cria na Api4Com, mas a gravação no banco ocorre no frontend (`useTelefoniaData.ts`), sem persistir payload completo da Api4Com e sem rollback robusto.

Plano de implementação

1) Corrigir filtro de membros no `RamalDialog.tsx`
- Normalizar todos os IDs com `Number(...)` antes de comparar (`user.id`, `teamMembers[].id`, `assigned_member_id`).
- Aplicar filtro por conjunto numérico (`Set<number>`) para excluir usuários já vinculados.
- Adicionar trava no salvar: se o membro selecionado já tiver ramal (validação defensiva), bloquear envio e exibir aviso.

2) Fortalecer regra de “1 membro = 1 ramal por agente” no banco
- Criar índice único parcial em `phone_extensions`:
  - `(cod_agent, assigned_member_id)` quando `assigned_member_id IS NOT NULL`.
- (Opcional recomendado) índice único parcial para evitar duplicidade técnica de vínculo com Api4Com:
  - `(cod_agent, api4com_ramal)` quando `api4com_ramal IS NOT NULL`.

3) Persistir “todas as informações” da criação
- Adicionar colunas em `phone_extensions` para dados de provisionamento:
  - `api4com_email text`
  - `api4com_first_name text`
  - `api4com_last_name text`
  - `api4com_raw jsonb default '{}'::jsonb` (payload completo de resposta)
- Atualizar tipos TS (`src/pages/admin/telefonia/types.ts`) para refletir os novos campos.

4) Mover gravação para o backend no `api4com-proxy` (ação `create_extension`)
- Expandir parâmetros recebidos: `assignedMemberId`, `label`, `email`, `firstName`, `lastName`.
- Fluxo da ação:
  - Validar se o membro já tem ramal para o `codAgent` (respeitando a nova unicidade).
  - Gerar senha aleatória no backend.
  - Criar ramal na Api4Com.
  - Inserir no banco já com:
    - `api4com_id`, `api4com_ramal`, `api4com_password`
    - `api4com_email`, nome/sobrenome, `api4com_raw`
    - `assigned_member_id`, `label`, `cod_agent`, `is_active`
  - Se falhar inserção no banco após criar na Api4Com, executar rollback (delete na Api4Com) para evitar inconsistência.

5) Simplificar frontend em `useTelefoniaData.ts`
- `createExtension` passa os dados completos para a função backend e deixa de fazer `insert` direto em `phone_extensions`.
- Manter invalidação de query e toasts de sucesso/erro.
- Ajustar mensagens para refletir “ramal criado na Api4Com e salvo”.

Validação (E2E)
- Abrir “Novo Ramal” com usuários já vinculados existentes e confirmar que não aparecem.
- Criar novo ramal e validar:
  - Ramal foi criado na Api4Com.
  - Registro foi salvo com `api4com_id`, `api4com_ramal`, `api4com_password`, `api4com_email` e `api4com_raw`.
  - Sem duplicidade para o mesmo usuário.
- Simular erro de banco (ou conflito) e confirmar rollback (não deixar ramal órfão na Api4Com).

Detalhes técnicos (resumo)
- Arquivos principais:
  - `src/pages/telefonia/components/RamalDialog.tsx` (normalização e filtro)
  - `src/pages/telefonia/hooks/useTelefoniaData.ts` (criação via backend only)
  - `supabase/functions/api4com-proxy/index.ts` (create + persist + rollback)
  - `src/pages/admin/telefonia/types.ts` (novos campos)
  - migration SQL (índices únicos + colunas de payload)
