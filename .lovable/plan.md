

# Ajustar dados do plano na tela de telefonia do cliente

## Problema
A query do plano em `useTelefoniaData.ts` não inclui os novos campos (`extra_extensions`, `billing_period`, `start_date`, `due_date`) e o cálculo de `maxExtensions` ignora ramais extras. A UI mostra apenas nome do plano e quantidade base, sem considerar extras nem período/vencimento.

## Correções

### 1. `useTelefoniaData.ts` — query e cálculo
- Expandir o select do join para incluir `extra_extension_price` do plano
- Retornar `extra_extensions`, `billing_period`, `start_date`, `due_date` do `phone_user_plans`
- Corrigir `maxExtensions` para: `plan.max_extensions + plan.extra_extensions`

### 2. `MeusRamaisTab.tsx` — exibir dados completos
- Mostrar: nome do plano, período (Mensal/Trimestral/Semestral/Anual), ramais (X do plano + Y extras = Z total)
- Mostrar datas: início e vencimento
- Badge de vencido se `due_date < hoje`

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/pages/telefonia/hooks/useTelefoniaData.ts` | Incluir novos campos no return, corrigir maxExtensions |
| `src/pages/telefonia/components/MeusRamaisTab.tsx` | Exibir período, extras, datas e status de vencimento |

