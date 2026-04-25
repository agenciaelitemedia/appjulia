
## Problema

No `DealDetailsSheet` (sidebar de detalhes do card no CRM Builder), o seletor "Responsável" está hoje populado com `useMyAgents` — que retorna **agentes de IA** (`myAgents` + `monitoredAgents`), exibindo `client_name || business_name || cod_agent`.

Isso está **errado**: o usuário deixou claro que a lista de responsáveis deve ser **idêntica à da página Equipe**, incluindo o **responsável principal (dono)** e qualquer outro membro humano da equipe — não agentes de IA.

A fonte oficial e única correta é a view `vw_equipe` (já consultada em `useTeamByClient` / `getTeamByClient`), que retorna todos os usuários do mesmo `client_id` (dono `admin`/`user` + subordinados `time`/`advogado`/`comercial`/`colaborador`).

## Mudanças

### 1. `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

- **Remover** o uso de `useMyAgents` para popular o seletor de Responsável.
- **Usar** `useTeamByClient` (mesma query da página Equipe — `vw_equipe` filtrada por `client_id` do usuário logado).
- A lista vinda de `useTeamByClient` já inclui o **dono/responsável principal** (`role` `admin`/`user`) — não filtrar por role.
- **Incluir o próprio usuário logado** na lista (diferente da página Equipe, que o esconde, aqui ele precisa poder ser atribuído a si mesmo). Como `vw_equipe` já contém o usuário logado, basta não aplicar o filtro de exclusão que a página Equipe usa.
- Usar `member.name` como label e como valor armazenado em `assigned_to` (mantém compatibilidade com o restante do sistema, que armazena o nome em `crm_deals.assigned_to`).
- Ordenar alfabeticamente por nome.
- Manter a opção `"Não atribuído"` no topo.

Exemplo do novo bloco:
```ts
import { useTeamByClient } from '@/hooks/useTeamByClient';
// ...
const { data: team = [] } = useTeamByClient();
const assigneeOptions = [...team]
  .map(m => m.name)
  .filter(Boolean);
const uniqueAssignees = Array.from(new Set(assigneeOptions))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));
```

E remover o import e uso de `useMyAgents` neste arquivo.

### 2. Verificação de outros pontos no CRM Builder

Auditar e corrigir, se existirem, outros locais do CRM Builder onde o seletor de Responsável seja populado de forma diferente (ex: dialog de criar/editar deal, filtros de board). Pontos a verificar:

- `src/pages/crm-builder/components/deals/DealFormDialog.tsx` (ou equivalente) — campo "Responsável" no formulário de criar/editar.
- Filtros de responsável no header/board do CRM Builder (se houver).

Em todos esses pontos, a regra é a mesma: usar `useTeamByClient` e exibir `member.name`. Caso algum deles esteja correto (já usando `useTeamByClient`), não tocar.

### 3. Não alterar o TransferDialog do chat

O `TransferDialog` do módulo /chat (`src/components/chat/TransferDialog.tsx`) continua usando `useMyAgents` porque ali o objetivo é transferir entre **agentes de IA**, não entre membros humanos da equipe. Esse caso é diferente e não está no escopo desta correção.

## Resultado esperado

- O seletor "Responsável" no `DealDetailsSheet` mostra exatamente os mesmos nomes que aparecem na página `/equipe`, **mais o dono/responsável principal** (que naturalmente faz parte de `vw_equipe`).
- Nenhum agente de IA aparece mais nessa lista.
- Qualquer outro seletor de Responsável dentro do CRM Builder fica alinhado com essa mesma fonte.
