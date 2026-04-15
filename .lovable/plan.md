

## Plano: Sincronizar responsável entre CRM e Chat Humano

### Problema
As queries do CRM (`useCRMCards`, `useCRMCardByWhatsapp`) usam `a.owner_name` — o nome do **dono do agente** (da view `vw_list_client-agents-users`), não o responsável atribuído ao card (`c.owner_name`). Já a query `get_inactive_sessions` usa corretamente `c.owner_name`. Isso causa a inconsistência: no chat humano aparece o responsável correto, mas nos detalhes do CRM aparece sempre o dono do agente.

### O que será feito

**Arquivo: `src/pages/crm/hooks/useCRMData.ts`**

Alterar 3 queries SQL para usar `c.owner_name` ao invés de `a.owner_name`:

1. **`useCRMCards`** (linha ~141): trocar `a.owner_name` por `c.owner_name`
2. **`useCRMCardByWhatsapp`** (linha ~203): trocar `a.owner_name` por `c.owner_name`
3. **`useCRMMonitoring`** (se aplicável): mesma correção

Manter `a.owner_business_name` como está (vem da view e é correto para esse campo).

### Resultado
O responsável exibido no CRM e no chat humano será o mesmo — ambos lendo de `crm_atendimento_cards.owner_name`.

