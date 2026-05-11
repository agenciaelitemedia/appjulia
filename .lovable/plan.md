## Diagnóstico

A "Etapa Julia" no chat sai por `useCRMStageByPhone` em `src/hooks/useCRMStageByPhone.ts`, que faz:

```sql
SELECT DISTINCT ON (c.whatsapp_number)
  c.whatsapp_number, c.stage_id, s.name, s.color
FROM crm_atendimento_cards c
LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
WHERE c.whatsapp_number = ANY($1)
ORDER BY c.whatsapp_number, c.updated_at DESC NULLS LAST
```

Problema: a query **ignora `cod_agent`**. Quando o mesmo telefone aparece em cards de **vários agentes diferentes** (situação comum: lead atendido por mais de uma operação Julia), o `DISTINCT ON` devolve apenas **o card mais recentemente atualizado**, que pode ser de **outro agente** — frequentemente um card antigo sem `stage_id` válido (ou um card cuja etapa não pertence ao agente vinculado à conversa).

Resultado: o frontend recebe `stageInfo` para o telefone, mas vinculado ao agente errado. Como o `ChatContactItem` agora mostra "Sem etapa" sempre que `stageName` vier vazio, o badge cai em fallback mesmo com etapa correta no CRM da Julia daquele atendimento.

Outra consequência: mesmo quando a query retorna o card certo, se o card "vencedor" tiver `stage_id` nulo (lead novo de outro agente), o `LEFT JOIN` devolve `name = null` e sobrescreve o card bom do agente certo.

## Correção proposta

Tornar a busca **chaveada por (telefone, cod_agent)** em vez de só telefone.

### 1. `src/hooks/useCRMStageByPhone.ts`
- Trocar assinatura para `useCRMStageByPhoneAgent(pairs: Array<{ phone: string; codAgent: string | null }>)`.
- Construir 2 arrays paralelos (phones expandidos + cod_agents correspondentes) e enviar ao DB.
- Query nova:

```sql
SELECT DISTINCT ON (c.whatsapp_number, c.cod_agent)
  c.whatsapp_number, c.cod_agent::text AS cod_agent,
  c.stage_id, s.name AS stage_name, s.color AS stage_color
FROM crm_atendimento_cards c
LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
WHERE (c.whatsapp_number, c.cod_agent::text) IN (
  SELECT unnest($1::varchar[]), unnest($2::varchar[])
)
ORDER BY c.whatsapp_number, c.cod_agent, c.updated_at DESC NULLS LAST
```

- Mapa de retorno: `Map<string, PhoneStageInfo>` onde a chave é `${phoneVariant}|${codAgent}`.
- Para cada linha, registrar todas as variantes BR de telefone com o mesmo `cod_agent`.

### 2. `src/components/chat/ChatList.tsx`
- Em vez de `allPhones`, montar `allPhoneAgentPairs` a partir das conversas: `{ phone: contact.phone, codAgent: queueAgentMap.get(conv.queue_id)?.codAgent }` (apenas quando `hasAgent`).
- Lookup por `stageByPhone.get(`${normPhone}|${agentCodAgent}`)`.
- Manter o fallback "Sem etapa" só quando realmente não existir card para aquele par.

### 3. `src/components/chat/ContactDetailPanel.tsx`
- Mesmo ajuste: passar `(phone, codAgent)` resolvido do contato/conversa selecionada para a nova hook (ou criar variante específica `useCRMStageForContact(phone, codAgent)`).

## Validação

- Após o ajuste, rodar uma checagem visual em conversas que estavam com "Sem etapa" mas têm card no CRM Julia do agente da fila — devem mostrar a etapa correta.
- Verificar que conversas sem card permanecem com "Sem etapa".
- Verificar que conversas em que o card pertence a outro agente (não o da fila) **não** mostram etapa daquele agente alheio.

## Fora de escopo

- Não alteramos schema, triggers ou RLS.
- Não mexemos em UI de tags/CRM Builder.
- Sem mudança em fila/queue routing.