

# Alterar query do card "Conversas do Whatsapp"

## Mudança

Trocar `COUNT(DISTINCT session_id)` por `COUNT(whatsapp)` no hook `useCRMJuliaConversations`.

## Arquivo alterado
| Arquivo | Ação |
|---|---|
| `src/pages/crm/hooks/useCRMData.ts` | Trocar `COUNT(DISTINCT session_id)` por `COUNT(whatsapp)` na query de conversas |

