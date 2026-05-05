## Problema

No header da conversa (`ChatHeader.tsx`), o card do CRM da Jul.IA não é encontrado para muitos contatos porque a busca é feita com **um único formato** de telefone (`WHERE c.whatsapp_number = $1`). 

O chat normaliza números BR para 13 dígitos (com 9º dígito), mas a tabela `crm_atendimento_cards` frequentemente armazena números de DDDs antigos com 12 dígitos (sem o 9). Resultado: o status/etapa do lead não aparece no header, o botão de detalhes fica desabilitado, contrato e status do agente também falham.

O mesmo problema já foi resolvido em outros lugares (ex.: `useCRMStageByPhone`, `ChatList`) usando `getBrPhoneVariants` + `WHERE col = ANY($1::varchar[])`.

## Solução

Aplicar o mesmo tratamento de variantes BR em `useCRMCardByWhatsapp` (a hook usada pelo `CrmActionBar` no `ChatHeader`), buscando o card por qualquer variante do telefone (com e sem o 9º dígito) e retornando o mais recente.

### Mudanças

1. **`src/pages/crm/hooks/useCRMData.ts` — `useCRMCardByWhatsapp`**
   - Importar `getBrPhoneVariants` de `@/lib/phoneVariants`.
   - Expandir o telefone recebido em todas as variantes BR.
   - Trocar `WHERE c.whatsapp_number = $1` por `WHERE c.whatsapp_number = ANY($1::varchar[])`.
   - Manter `ORDER BY c.stage_entered_at DESC LIMIT 1` para pegar o card mais relevante.
   - Manter a queryKey estável (variantes ordenadas) para o cache do React Query.

2. **Verificar hooks paralelos no header** (somente leitura, sem mudança esperada):
   - `useContractInfo(phone, codAgent)` e `externalDb.getSessionStatus(phone, codAgent)` — se também filtrarem por `whatsapp_number = $1` exato, aplicar o mesmo padrão de variantes. Caso contrário, manter como está.

### Resultado esperado

Ao abrir uma conversa no `/chat`, o `CrmActionBar` no header passará a:
- Identificar a etapa atual do lead na Jul.IA mesmo quando o número está salvo em formato legado (12 dígitos).
- Habilitar corretamente o botão "Detalhes do card CRM".
- Refletir contrato e status do agente nos casos antes quebrados.
