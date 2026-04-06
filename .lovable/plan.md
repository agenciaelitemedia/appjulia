

# Ativar Perfis "Advogado" e "Comercial" no Cadastro de Equipes

## Resumo

Adicionar seletor de perfil (time, advogado, comercial) no dialog de criação/edição de membros de equipe. O perfil "advogado" automaticamente inclui o módulo `adv_dashboard` nas permissões. O perfil "comercial" funciona como o "time" mas com role diferente para futuras diferenciações.

## Alterações

### 1. Tipos — Adicionar role `comercial`
- `src/types/permissions.ts`: adicionar `'comercial'` ao `AppRole`
- `src/pages/admin/permissoes/types.ts`: adicionar label `comercial: 'Comercial'`

### 2. Dialog de Equipe — Seletor de perfil
- `src/pages/equipe/components/EquipeMemberDialog.tsx`:
  - Adicionar campo `<Select>` para escolher o perfil: "Time" (padrão), "Advogado", "Comercial"
  - Quando "Advogado" for selecionado, adicionar automaticamente `adv_dashboard` ao `selectedModuleCodes`
  - Passar o `role` selecionado para o mutation de criação/atualização

### 3. Hooks e externalDb — Passar role
- `src/pages/equipe/hooks/useEquipeData.ts`: incluir `role` nos dados enviados para `insertTeamMember` e `updateTeamMember`
- `src/lib/externalDb.ts`: aceitar `role` nos parâmetros de `insertTeamMember` e `updateTeamMember`

### 4. Edge Function — Usar role dinâmico
- `supabase/functions/db-query/index.ts`:
  - `insert_team_member`: trocar `'time'` hardcoded por `data.role || 'time'`
  - `update_team_member`: adicionar `UPDATE users SET role = $4` quando role fornecido

### 5. Login — Redirect para comercial (mantém dashboard padrão)
- Nenhuma mudança no login. Comercial vai para `/dashboard` normalmente. Advogado já redireciona para `/adv/dashboard`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/types/permissions.ts` | Adicionar `'comercial'` ao AppRole |
| `src/pages/admin/permissoes/types.ts` | Label para comercial |
| `src/pages/equipe/components/EquipeMemberDialog.tsx` | Seletor de perfil + auto-add adv_dashboard |
| `src/pages/equipe/hooks/useEquipeData.ts` | Passar role no create/update |
| `src/lib/externalDb.ts` | Aceitar role em insertTeamMember/updateTeamMember |
| `supabase/functions/db-query/index.ts` | Role dinâmico no insert/update |

