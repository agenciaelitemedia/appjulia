# Criar Card no CRM — Painel lateral + integração CRM Builder ↔ Chat ↔ Julia

## Objetivo
Substituir o atual diálogo "Criar lead no CRM" por um painel lateral (Sheet à direita) chamado **"Criar Card no CRM"**, com seleção em duas etapas (Quadro → Etapa) usando lista expansível, e preparar o **CRM Builder** para representar cards vinculados a:
- **Chat** (conversa omnichannel) — abre direto na conversa
- **Julia** (CRM da Julia / `crm_atendimento_cards`) — abre detalhes completos do lead Julia
- **Ambos** (chat + Julia) no mesmo card

---

## 1. Renomear ação no chat
Arquivo: `src/components/chat/ChatHeader.tsx` (linha 572-575)
- Trocar label `"Criar lead no CRM"` → `"Criar Card no CRM"`.
- Trocar ícone para algo mais coerente (`Kanban` ou manter `Sparkles`).

## 2. Novo painel lateral `CreateCrmCardSheet`
Substitui `CreateCrmLeadDialog.tsx` (mantém o arquivo antigo apenas como referência ou já remove). Novo arquivo: `src/components/chat/CreateCrmCardSheet.tsx`.

**Layout (Sheet `side="right"`, largura ~`sm:max-w-md`)**
- Cabeçalho: "Criar Card no CRM" + descrição curta com nome/telefone do contato.
- **Passo 1 — Lista de Quadros (Collapsible/Accordion)**
  - Cada quadro renderizado como card clicável (ícone + nome + cor + contagem de etapas).
  - Ao clicar, expande inline mostrando as **etapas (pipelines)** daquele quadro como lista de chips/itens selecionáveis.
  - Apenas um quadro expandido por vez (Accordion `type="single"`).
- **Passo 2 — Detalhes do card** (aparece embaixo após selecionar etapa)
  - Título (pré-preenchido com nome do contato)
  - Valor estimado (opcional)
  - Prioridade
  - Descrição
  - **Tipo de vínculo** (auto-detectado, exibido como badges informativos):
    - 🟢 `Chat` — sempre presente (vem da conversa atual)
    - 🟡 `Julia` — se houver `crm_atendimento_cards` com mesmo `whatsapp_number` + `cod_agent`, oferecer toggle "Vincular também ao card da Julia" (busca em background ao abrir o sheet).
- Footer: `Cancelar` | `Criar Card`.

**Estrutura de dados gravada em `crm_deals.custom_fields`** (jsonb):
```json
{
  "source": "chat",
  "links": {
    "chat": {
      "conversation_id": "...",
      "contact_phone": "...",
      "contact_name": "...",
      "queue_id": "..."
    },
    "julia": {
      "card_id": 123,
      "whatsapp_number": "...",
      "cod_agent": "..."
    }
  }
}
```
Sem migration necessária — `custom_fields jsonb` já existe.

## 3. CRM Builder: card com vínculos (`DealCard.tsx`)
Adicionar **badges de vínculo** no rodapé do card (acima do "Na fase: ..."):
- Badge azul `💬 Chat` se `custom_fields.links.chat` existir → clique navega para `/chat?conversation=<id>` (ou abre painel).
- Badge roxo `⚖️ Julia` se `custom_fields.links.julia` existir → clique navega para `/crm/leads?card=<id>` ou abre `CRMLeadDetailsDialog`.
- Ambos podem coexistir.

**Comportamento no clique do card (DealDetailsSheet)**
- Adicionar nova seção **"Vínculos"** com:
  - Bloco Chat: avatar + nome + último snippet (busca em `chat_conversations` por id) + botão **"Abrir conversa"**.
  - Bloco Julia: nome + estágio atual + botão **"Ver detalhes do lead Julia"** que abre o `CRMLeadDetailsDialog` reutilizado de `src/pages/crm/`.

## 4. Hook utilitário `useCardLinks`
Novo: `src/pages/crm-builder/hooks/useCardLinks.ts`
- `getChatLink(deal)` / `getJuliaLink(deal)` — extraem de `custom_fields.links`.
- `useJuliaCardPreview(whatsapp, codAgent)` — React Query que busca `crm_atendimento_cards` no banco externo via Edge Function existente (`db-query`) para popular o painel de detalhes.
- `useChatConversationPreview(conversationId)` — busca em `chat_conversations` (Supabase) — last_message_at, snippet.

## 5. Detecção automática Julia ao abrir o sheet
Ao abrir `CreateCrmCardSheet`, dispara consulta em paralelo:
```sql
SELECT id, contact_name, stage_id, stage_name 
FROM crm_atendimento_cards 
WHERE whatsapp_number = $1 AND cod_agent = $2 LIMIT 1;
```
via `db-query` Edge Function. Se encontrar, mostra opção "Vincular ao card existente da Julia (#ID — etapa)".

## 6. Arquivos afetados
**Criar**
- `src/components/chat/CreateCrmCardSheet.tsx` (substitui o dialog)
- `src/pages/crm-builder/hooks/useCardLinks.ts`
- `src/pages/crm-builder/components/deals/DealLinksSection.tsx` (seção "Vínculos" no DealDetailsSheet)

**Modificar**
- `src/components/chat/ChatHeader.tsx` — trocar label, importar novo sheet, remover `CreateCrmLeadDialog`.
- `src/pages/crm-builder/components/deals/DealCard.tsx` — adicionar badges de vínculo + handlers de navegação.
- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` — incluir `<DealLinksSection deal={deal} />`.

**Remover (após validação)**
- `src/components/chat/CreateCrmLeadDialog.tsx`

## 7. Memória a salvar
Após implementação:
- `mem://features/crm/builder-card-link-types` — descreve schema `custom_fields.links.{chat,julia}`, badges no DealCard, navegação cross-módulo.

---

## Pontos a confirmar com o usuário antes de executar
1. **Quando o vínculo Julia existir**, o card deve **espelhar** automaticamente movimentações (mover deal quando o card Julia mudar de fase) ou ficar apenas com o **link de leitura**?
2. **Botão "Abrir conversa"** no DealDetailsSheet do CRM Builder — devo navegar para `/chat?conversation=<id>` (rota existe?) ou abrir um drawer interno?
3. **Edição posterior**: usuário poderá adicionar/remover vínculos depois de criado o card (via `DealLinksSection`)?