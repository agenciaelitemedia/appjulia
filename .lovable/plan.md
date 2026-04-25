
## Objetivo
Criar um único componente de seleção de equipe/responsável, com **busca por texto**, **avatares**, **badges de papel** e visual padronizado, e substituir as 3 implementações atuais (que hoje usam `Select` simples ou `Popover` artesanal).

---

## 1. Novo componente: `src/components/TeamMemberSelect.tsx`

Baseado no padrão já existente do `AgentSearchSelect` (Popover + cmdk Command + busca + tooltip), mas para **membros da equipe**.

### Props
```ts
interface TeamMemberSelectProps {
  members: TeamMemberOption[];          // lista (vinda de useTeamByClient ou useTeamForAgent)
  value: string | null;                 // id ou nome selecionado (configurável via valueKey)
  valueKey?: 'id' | 'name';             // default 'name' (compatível com owner_name no DB)
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // Opções extras visuais
  allowUnassigned?: boolean;            // mostra "Não atribuído" no topo (default true)
  unassignedLabel?: string;             // default "Sem responsável"
  extraOptions?: Array<{                // ex.: "Julia IA", "Meus cards"
    value: string;
    label: string;
    icon?: LucideIcon;
    iconClassName?: string;             // ex.: 'text-green-500'
    badgeVariant?: 'default'|'secondary'|'outline';
    badgeLabel?: string;
  }>;
  showCurrentUserShortcut?: boolean;    // injeta "Eu" (atalho) no topo
}

interface TeamMemberOption {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
  photo?: string | null;
}
```

### UI / estilo
- **Trigger**: botão `outline` com avatar do selecionado (ou ícone `Users`) + nome + chevron. Largura controlável via `className`.
- **Popover (z-50, bg-popover)**: 
  - `CommandInput` com ícone `Search` e placeholder “Buscar membro…”.
  - Lista de no máximo 300px com scroll. Cada item:
    - `Avatar` (foto ou iniciais; fallback colorido com hash do nome).
    - Nome em `font-medium`.
    - `Badge` pequeno do papel (`role`) — cores por papel:
      - `proprietario` → âmbar, `admin` → roxo, `advogado` → azul, `comercial` → verde, `time` → cinza.
    - E-mail em `text-xs text-muted-foreground` (linha 2, truncado).
    - `Check` à esquerda quando selecionado.
  - Tooltip com nome completo + role + email.
- **Seções (CommandGroup com heading)**:
  1. Atalhos (`extraOptions` + “Eu” quando habilitado) — separador.
  2. Opção “Sem responsável” (quando `allowUnassigned`).
  3. Equipe (membros).
- **Empty state**: “Nenhum membro encontrado.”
- **Acessível**: `role="combobox"`, `aria-expanded`, navegação por setas (cmdk já fornece).

### Helpers internos
- `getInitials(name)`, `getRoleColor(role)`, `getAvatarBgFromName(name)` — exportados também para reuso.

### Onde NÃO trocar
- `TransferDialog` do chat: usa lista de **agentes IA**, não equipe humana — segue inalterado (já documentado em memória).

---

## 2. Aplicações

### 2.1. CRM Builder — `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`
- Substituir o bloco atual `<Select>` (linhas ~266–280) do campo Responsável por:
  ```tsx
  <TeamMemberSelect
    members={team}
    valueKey="name"
    value={assigneeDraft || null}
    onValueChange={(v) => setAssigneeDraft(v ?? '')}
    allowUnassigned
    unassignedLabel="Não atribuído"
    showCurrentUserShortcut
    className="flex-1"
  />
  ```
- Mantém botões Salvar/Cancelar atuais e o estado `assigneeDraft`.

### 2.2. Chat (`/chat`) — `src/components/chat/ChatList.tsx`
- Substituir o `<Select value={ownerFilter} ...>` (linha ~480) que lista `teamMembers` pelo `TeamMemberSelect`.
- Configuração:
  ```tsx
  <TeamMemberSelect
    members={teamMembers}
    valueKey="name"             // o filtro já compara por nome (vide linha 255)
    value={ownerFilter === 'all' ? null : ownerFilter}
    onValueChange={(v) => setOwnerFilter(v ?? 'all')}
    allowUnassigned
    unassignedLabel="Sem atendente"
    extraOptions={[
      { value: 'all',  label: 'Todos os atendentes', icon: Users },
      { value: 'mine', label: 'Meus atendimentos', icon: UserCheck, badgeLabel: 'EU', badgeVariant: 'secondary' },
    ]}
    placeholder="Atendente"
    className="h-9"
  />
  ```
- Ajuste mínimo na lógica do filtro (linhas 245–256): tratar `value === null` como “all” se o componente devolver `null`. Como já mapeamos `null → 'all'` no `onValueChange`, a lógica atual permanece intacta.
- Atualizar `activeFilterCount` para considerar `ownerFilter !== 'all'` (já faz).

### 2.3. CRM da Julia — `src/pages/crm/components/CRMLeadDetailsDialog.tsx`
- Substituir o `Popover` artesanal (linhas ~396–433) que mostra “Julia IA” + lista de membros pelo `TeamMemberSelect`:
  ```tsx
  <TeamMemberSelect
    members={teamMembers}
    valueKey="name"
    value={card.owner_name || null}
    onValueChange={(v) => handleOwnerChange(v ?? '')}
    allowUnassigned
    unassignedLabel="Sem responsável"
    extraOptions={[
      { value: 'Julia IA', label: 'Julia IA', icon: Bot, iconClassName: 'text-green-500', badgeLabel: 'IA', badgeVariant: 'secondary' },
    ]}
    className="ml-auto"
  />
  ```
- Remover botão “Alterar” + estado `ownerPopoverOpen` (não mais necessários).
- Manter o badge atual de exibição (linha 392) acima do select OU exibir só o select como trigger compacto (decisão: **deixar só o select**, já que ele exibe o membro selecionado com avatar — UI mais limpa).

### 2.4. Filtro de Responsável da página `/crm` — `src/pages/crm/CRMPage.tsx`
- **Bonus de consistência (recomendado, fora do pedido literal mas mesma família)**: trocar o `<Select>` (linhas 211–229) por `TeamMemberSelect` com:
  ```tsx
  extraOptions={[
    { value: 'all',  label: 'Todos', icon: Users },
    { value: 'mine', label: 'Meus cards', icon: UserCheck, badgeLabel: 'EU' },
  ]}
  unassignedLabel="Sem Responsável"
  ```
- **Confirmar com o usuário se quer também aqui** — caso não, deixo só o do `CRMLeadDetailsDialog`.

---

## 3. Tipagem e dependências
- Reutilizar `Command`, `Popover`, `Tooltip`, `Avatar`, `Badge` (já no projeto via shadcn).
- Compatível com as duas formas de retorno de equipe:
  - `useTeamByClient` → `{ id, name, email, role, photo, client_id }`
  - `useTeamForAgent` → `{ id, name, role, ... }` (sem photo) — fallback para iniciais.

## 4. QA visual
- Verificar dark mode (cores de role / avatar).
- Verificar truncate em nomes longos.
- Garantir z-index do popover acima do `Sheet` do CRM Builder e do `Dialog` do CRM Julia (`z-50` no `PopoverContent`, igual ao `AgentSearchSelect`).

## Arquivos a criar/editar
- **Criar**: `src/components/TeamMemberSelect.tsx`
- **Editar**: 
  - `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`
  - `src/components/chat/ChatList.tsx`
  - `src/pages/crm/components/CRMLeadDetailsDialog.tsx`
  - (opcional) `src/pages/crm/CRMPage.tsx`
