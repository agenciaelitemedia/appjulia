---
name: CRM Builder card link types (chat / Julia)
description: Cards do CRM Builder armazenam vínculos em custom_fields.links.{chat,julia}; criação via Sheet "Criar Card no CRM" no chat; DealCard exibe badges; DealDetailsSheet abre conversa ou CRMLeadDetailsDialog.
type: feature
---
Cards do CRM Builder (`crm_deals`) podem ter vínculos opcionais armazenados em `custom_fields.links`:

```json
{
  "source": "chat",
  "links": {
    "chat":  { "conversation_id": "...", "contact_phone": "...", "contact_name": "..." },
    "julia": { "card_id": 123, "whatsapp_number": "...", "cod_agent": "...", "stage_id": 4, "stage_name": "..." }
  }
}
```

- Criação a partir do chat: botão "Criar Card no CRM" no `ChatHeader` abre `CreateCrmCardSheet` (Sheet lateral). Lista quadros expansíveis → seleciona etapa → preenche título/valor/prioridade. Detecta automaticamente card Julia existente via `crm_atendimento_cards` (whatsapp_number + cod_agent) e oferece toggle de vínculo.
- Sem migration: `crm_deals.custom_fields jsonb` já existe.
- `DealCard` mostra badges `Chat` (azul) e `Julia #id` (roxo) quando vínculos presentes.
- `DealDetailsSheet` inclui `DealLinksSection` com botão "Abrir" (chat → `/chat` via sessionStorage `chat_pending_contact_id`) e "Ver" (Julia → `CRMLeadDetailsDialog`).
- Helpers: `getChatLink`, `getJuliaLink`, `useChatConversationPreview`, `useJuliaCardPreview` em `src/pages/crm-builder/hooks/useCardLinks.ts`.
- Também grava vínculo redundante em `chat_crm_links` (external_system='crm_builder').

**Sincronização Julia → card (badges, NÃO move no kanban):**
- `useJuliaCardPreview` faz refetch a cada 60s e expõe `stage_name`, `stage_color`, `business_name` ao vivo.
- `DealCard` mostra badges informativos: `Julia #id` + etapa atual da Julia (com cor original) + business_name. O kanban NÃO é alterado quando a etapa Julia muda — apenas os badges atualizam.

**Restrições para cards vinculados (chat ou Julia):**
- Não podem ser editados nem desvinculados.
- Menu do `DealCard` mostra apenas "Excluir card" (usa `archiveDeal`).
- `DealDetailsSheet` esconde o botão "Editar"; o botão de arquivar vira "Excluir card".
- Cards normais (sem vínculo) mantêm fluxo completo de edição/Ganho/Perdido/Arquivar.
