## Migração Admin Telefonia: Cod Agent → Client ID (UI)

Como a telefonia agora é por **cliente** (e não por agente), as telas de admin devem refletir isso: buscar, exibir e cadastrar pelo **Cliente** (id + nome + escritório), com `cod_agent` apenas como informação técnica auxiliar (ou removido).

---

### 1. AddTelefoniaDialog (Adicionar Telefonia)

**Antes**: busca agente (`useAgentSearch`) → grava `cod_agent`.
**Depois**: busca **cliente** (`externalDb.searchClients`) → grava `client_id` + nome/escritório do cliente. Resolução de `cod_agent` (legado/dual-write) acontece automaticamente no backend via fallback existente.

Mudanças:
- Trocar `useAgentSearch` por uma busca de clientes (novo hook `useClientSearch` em `src/pages/admin/telefonia/hooks/`).
- Cada resultado mostra: **ID do Cliente** (mono), Nome, Escritório.
- `assignPlan.mutate` recebe `clientId`, `clientName`, `businessName` (sem mais `codAgent` obrigatório).

### 2. AgentsTelefoniaTab (Listagem)

**Antes**: coluna "Cod Agent" + busca por código de agente.
**Depois**: coluna **"Cliente"** com `client_id` (mono) + Nome/Escritório. Busca por id/nome/escritório.

Mudanças:
- Renomear título do card para **"Clientes com Telefonia"**.
- Substituir coluna `Cod Agent` por **`Cliente`** (formato: `#270 — João Silva / Escritório X`).
- Filtro de busca passa a olhar `client_id`, `client_name`, `business_name`.
- Texto do diálogo de remoção: "remover a telefonia do cliente <strong>#270 João Silva</strong>".

### 3. ConfigTab (Configurações por Provedor)

**Antes**: coluna "Cód. Agente" + form pede "Cód. Agente".
**Depois**: coluna **"Cliente"** + form com seleção de cliente (busca).

Mudanças:
- Renomear título: **"Configurações por Cliente"**.
- Form: remover input texto livre `Cód. Agente`, substituir por **busca de cliente** (mesmo `useClientSearch`).
- Tabela: coluna `Cliente` com `client_id` (mono) + nome do cliente (resolvido via lookup local).
- Diálogo de remoção: "configuração do cliente <strong>#270 João Silva</strong>".

### 4. Hook `useTelefoniaAdmin`

- `userPlansQuery`: já carrega `client_id`. Adicionar enrichment opcional para nome do cliente quando faltar (`client_name` já vem persistido na própria linha em casos novos).
- `assignPlan`: aceita `clientId` direto (parâmetro principal); `codAgent` torna-se opcional/derivado.
- `saveConfig`: aceita `clientId` direto; resolução reversa de `cod_agent` via `db-query` (`SELECT cod_agent FROM agents WHERE client_id = $1 LIMIT 1`) para preservar legado durante Fase 4.
- `configQuery`: enriquecer com nome do cliente via `db-query` quando `client_id` estiver presente (lookup batch para evitar N+1).

### 5. Novo hook `useClientSearch`

Arquivo: `src/pages/admin/telefonia/hooks/useClientSearch.ts`
- Usa `externalDb.searchClients(term)` com debounce 300ms.
- Retorna `{id, name, business_name, email, phone}`.

---

### Riscos e Mitigações

1. **Configs/planos legados sem `client_id`**: backfill já foi executado (Fase 2). Dados antigos exibirão `cod_agent` como fallback no UI ("Cliente: #—" + sub-texto cinza com `cod_agent`).
2. **Múltiplos agentes do mesmo cliente**: ao gravar config nova por cliente, se já existe config antiga vinculada por `cod_agent`, exibir badge **"Migrado de cod_agent"** e permitir consolidação manual.
3. **Resolução reversa cod_agent ← client_id**: usado apenas para preservar dual-write durante Fase 4. Se cliente tiver múltiplos agentes, pega o primeiro (`ORDER BY id LIMIT 1`) — comportamento existente já validado na Fase 3.
4. **Edição mantém `client_id` imutável**: igual ao comportamento atual com `cod_agent` (`disabled={!!editing}`), evita mudar a chave de uma config existente.

### Detalhes técnicos

- Tipo `PhoneUserPlan` e `PhoneConfig` já têm `client_id: number | null` nos types do Supabase (Fase 2 migrou).
- Texto do `cod_agent` mantido como **sub-rótulo cinza pequeno** abaixo do `client_id` na coluna Cliente, para troubleshooting técnico do admin (não confundir com chave principal).
- Nenhuma migração SQL necessária — somente UI/hooks.

### Arquivos afetados

- `src/pages/admin/telefonia/components/AddTelefoniaDialog.tsx` (refatorar busca)
- `src/pages/admin/telefonia/components/AgentsTelefoniaTab.tsx` (renomear coluna, filtros, título)
- `src/pages/admin/telefonia/components/ConfigTab.tsx` (form com busca + coluna)
- `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts` (assinaturas `assignPlan`/`saveConfig`)
- **Novo**: `src/pages/admin/telefonia/hooks/useClientSearch.ts`

Aprove para eu implementar.
