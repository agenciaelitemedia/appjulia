# Corrigir "Sem etapa" na notificação de lead sem resposta

## O que está acontecendo

O lead 5582996211416 (escritório 294) realmente está na etapa **Entrada** do CRM da Julia — mas esse card vive no CRM legado (`crm_atendimento_cards`, card 62476, cod_agent 202603001, stage_id 1 = "Entrada"), confirmado também no espelho do CRM Builder.

A notificação e a prévia buscam a etapa em outro lugar: nas tabelas do **X-Julia** (`xj_deals` → `xj_pipelines`). Para o escritório 294 existem **0 registros** em `xj_deals`, logo a busca volta vazia e o texto cai em "Sem etapa no CRM".

Ou seja: a fonte da etapa está errada para escritórios que usam o CRM clássico da Julia (a grande maioria hoje).

## Correção

Passar a resolver a etapa em duas fontes, na ordem:

1. **CRM clássico (legado)** — `crm_atendimento_cards` + `crm_atendimento_stages`, casando por telefone (com as variantes brasileiras de 8/9 dígitos, mesma regra já usada no chat) e pegando o card mais recente.
2. **X-Julia** (`xj_deals` → `xj_pipelines`) — só como fallback, para escritórios que já usam esse CRM.
3. Se nenhuma das duas tiver card, mantém "Sem etapa".

Aplicar essa mesma ordem nos dois lugares para não haver divergência entre o que a prévia mostra e o que a mensagem envia:

- Disparo real: `supabase/functions/alert-notifications-cron/index.ts` (função `fetchCrmStage`) — a função já tem conexão com o banco legado, é só usá-la aqui.
- Prévia no cartão: `src/modules/notificacoes-alertas/hooks/useNoResponsePreview.ts` — buscar as etapas em lote pelo `externalDb.raw`, reaproveitando `getBrPhoneVariants`.

Depois, republicar a função de disparo.

## Detalhes técnicos

- Match por telefone: usar `getBrPhoneVariants` (variantes com/sem o 9º dígito) em vez do `ILIKE %últimos 8 dígitos%` atual, que é frágil e pode casar telefone de outro DDD.
- Consulta legada (uma só, em lote na prévia): `crm_atendimento_cards c LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id WHERE c.whatsapp_number = ANY($1) ORDER BY c.updated_at DESC` — o card mais recente por telefone vence.
- Nenhuma mudança de schema; nenhuma alteração na regra de elegibilidade (status pendente/em atendimento, última mensagem nossa, janela de 2 dias).
