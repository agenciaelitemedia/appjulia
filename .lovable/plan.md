

# Desativar/Remover agente da telefonia

## Mudanças

### 1. Hook `useTelefoniaAdmin.ts` — adicionar mutation `deactivateUserPlan`
- Nova mutation que faz `update({ is_active: false })` no `phone_user_plans` pelo `id`
- Toast de sucesso "Telefonia desativada" e invalidação da query

### 2. `AgentsTelefoniaTab.tsx` — botões de ação
- Importar `DropdownMenu` (já existe no projeto) e ícones `MoreHorizontal`, `Power`, `Trash2`
- Substituir o botão de lápis isolado por um `DropdownMenu` com 3 opções:
  - **Editar** (ícone Pencil) — abre o EditTelefoniaDialog (comportamento atual)
  - **Desativar/Ativar** (ícone Power) — toggle `is_active`, com confirmação inline
  - **Remover** (ícone Trash2, vermelho) — deleta o registro com confirmação via `AlertDialog`
- Adicionar filtro "Inativos" no select de status existente

### 3. Hook `useTelefoniaAdmin.ts` — adicionar mutation `deleteUserPlan`
- Nova mutation que faz `delete()` no `phone_user_plans` pelo `id`
- Toast "Telefonia removida"

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts` | Adicionar `deactivateUserPlan` e `deleteUserPlan` |
| `src/pages/admin/telefonia/components/AgentsTelefoniaTab.tsx` | DropdownMenu com Editar/Desativar/Remover + AlertDialog de confirmação |

