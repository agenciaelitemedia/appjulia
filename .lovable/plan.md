

## Adicionar filtros de Tempo, Responsáveis e Etapas no Chat

Replicar os 3 filtros do `/atendimento-humano` dentro do painel de filtros já existente do `ChatList`, mantendo o mesmo visual e comportamento.

### Filtros a adicionar (dentro do painel `filtersOpen`)

**1. Filtro de Tempo (pills no estilo SLA)**
- Opções: `Todos` / `Hoje` / `Ontem` / `7 dias` / `Mês atual` / `3 meses`
- Aplica sobre `contact.last_message_at` (fallback `updated_at`).
- Visual: mesmas pills `rounded-md text-[10px]`. Estado ativo neutro (`bg-foreground/10`).

**2. Filtro de Responsáveis (Select estilo atendimento-humano)**
- Substitui as 3 pills atuais (`Todos / Meus / Sem responsáveis`) por um **Select** completo igual ao do `InactiveLeadsList`:
  - `Todos`
  - `MEUS CARDS` (em destaque)
  - `Sem Responsável` (itálico)
  - Lista de membros da equipe (`teamMembers`)
- Aplica em `convMetaByContact.get(contact.id)?.assignedTo` comparando com `member.name` ou `String(user.id)`.
- Origem dos membros: `useTeamForAgent(codAgent)`. Como o chat opera com múltiplas filas, derivar `codAgent` da seguinte ordem:
  1. `selectedQueue` → primeiro agente vinculado via `queueAgentMap`
  2. Se "Todas as filas", usar o `cod_agent` do primeiro agente que o usuário possui (via `useUserAgents` ou contexto já existente).

**3. Filtro de Etapas (Popover multi-select estilo atendimento-humano)**
- Componente idêntico ao `InactiveLeadsList`: botão `Todas as etapas` → `Popover` com checkboxes + opção "Selecionar todas" + bolinha colorida da etapa.
- Origem das etapas: `useCRMStages()`.
- Aplicação no chat: cruzar telefone do contato (`contact.phone`) com `crm_atendimento_cards` para obter `stage_id`. Como o chat ainda não carrega esses cards, criar um novo hook leve `useCRMStageByPhone(phones[])` que retorna `Map<phone, stage_id>` consultando `crm_atendimento_cards` filtrando por `whatsapp_number IN (...)` e (opcional) `cod_agent`. Memoizar e revalidar a cada 60s.
- Filtragem: `result.filter(c => stageIds.length === 0 || stageIds.includes(stageByPhone.get(c.phone)))`.

### Ordem dos filtros dentro do painel

```text
[ icone Filter ] (já abre/fecha)
└── Painel:
    [ Modo (IA ativa / inativa / Atendente) ]   ← já existe
    [ SLA (Estourado / Em risco) ]              ← já existe
    [ Responsáveis (Select) ]                   ← SUBSTITUI as 3 pills atuais
    [ Status (Abertos/Concluídos/Encerrados) ]  ← já existe
    [ Tempo (pills)  ]                           ← NOVO
    [ Etapas (Popover multi-select) ]           ← NOVO
```

### Detalhes técnicos

- **Arquivo principal**: `src/components/chat/ChatList.tsx`
  - Novos estados: `periodFilter: LeadPeriod`, `ownerFilter: string`, `stageIds: number[]`.
  - Importar `useCRMStages`, `useTeamForAgent` de `@/pages/crm/hooks/useCRMData`.
  - Importar `getDateRange` (extraído ou copiado do `useInactiveLeads`).
  - Atualizar `activeFilterCount` para considerar os 3 novos filtros.
  - Estender `visibleContacts` com as 3 novas filtragens.

- **Novo hook**: `src/hooks/useCRMStageByPhone.ts`
  - Recebe array de telefones, retorna `Map<phone, { stageId, stageName, stageColor }>`.
  - Query no Supabase sobre `crm_atendimento_cards` (via edge function ou client direto, conforme padrão atual de `useCRMCards`).

- **Derivação de `codAgent`** para alimentar `useTeamForAgent`:
  - Hook auxiliar local `useChatPrimaryCodAgent()` que retorna o `cod_agent` da fila selecionada (ou primeiro agente do usuário).

- Sem mudanças de schema. Sem mudanças em `WhatsAppDataContext`.

### Arquivos alterados/criados

- **Modificado**: `src/components/chat/ChatList.tsx` — adicionar 3 filtros, substituir pills de Responsáveis pelo Select.
- **Criado**: `src/hooks/useCRMStageByPhone.ts` — mapear telefones do chat para etapas do CRM.
- **Reuso**: `useCRMStages`, `useTeamForAgent` do CRM; `LeadPeriod` + helper de período do `useInactiveLeads`.

