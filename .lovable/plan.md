
# Plano: Adicionar Ícone de Contrato no Card do CRM

## Resumo

Substituir o badge de etapa de contrato por um ícone de balança da justiça (Scale) que, ao clicar, abre um popup com informações do contrato e opção de download/abertura do documento.

---

## Mudanças Visuais

### Card do CRM (Antes vs Depois)

**Antes:**
- Badge com texto "Contrato em Curso" ou "Contrato Assinado" no topo do card

**Depois:**
- Ícone de balança (Scale) posicionado **antes** do ícone do WhatsApp
- Cor do ícone baseada na etapa:
  - `#06B6D4` (ciano) para "Contrato em Curso"
  - `#22C55E` (verde) para "Contrato Assinado"
- Efeito de destaque:
  - Animação de pulse sutil
  - Fundo colorido com opacidade ao hover
  - Sombra/glow na cor do estágio

---

## Arquivos a Criar/Modificar

### 1. Criar `src/pages/crm/components/ContractInfoDialog.tsx`

Novo componente de dialog para exibir informações do contrato, incluindo:
- Status do contrato (Criado, Em Curso, Assinado)
- Nome do signatário
- Data do contrato e assinatura
- Link para abrir o contrato (se não assinado)
- Botão de download (se assinado)
- Usa a mesma lógica de download do `ContratoDetailsDialog` via edge function `zapsign-file`

### 2. Criar Hook `src/pages/crm/hooks/useContractInfo.ts`

Hook para buscar informações do contrato baseado no número do WhatsApp e cod_agent:
```typescript
useContractInfo(whatsappNumber: string, codAgent: string)
```
Consulta a view `vw_desempenho_julia_contratos` para obter:
- `zapsing_doctoken` (token para download)
- `status_document` (CREATED, SIGNED, etc.)
- `signer_name`, `data_contrato`, `data_assinatura`
- Link do ZapSign (extraído do notes no histórico)

### 3. Modificar `src/pages/crm/components/CRMLeadCard.tsx`

- **Remover**: Badge de etapa de contrato (linhas 55-68)
- **Adicionar**: Ícone Scale antes do ícone WhatsApp com:
  - Condição: `card.has_contract_history === true`
  - Cor dinâmica baseada na etapa atual
  - Classes de animação/destaque
  - Handler para abrir o dialog de contrato
- Importar novo `ContractInfoDialog`

### 4. Atualizar `src/pages/crm/types.ts`

Adicionar interface `ContractInfo`:
```typescript
interface ContractInfo {
  zapsing_doctoken?: string;
  status_document: string;
  signer_name?: string;
  data_contrato?: string;
  data_assinatura?: string;
  verification_url?: string;
}
```

---

## Detalhes Técnicos

### Estilo do Ícone de Contrato

```tsx
<Button
  variant="ghost"
  size="icon"
  className={cn(
    "h-7 w-7 relative",
    "animate-pulse",
    "hover:scale-110 transition-transform",
    // Glow effect baseado na cor do estágio
    isContractSigned 
      ? "text-green-500 hover:bg-green-100/50 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
      : "text-cyan-500 hover:bg-cyan-100/50 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
  )}
  onClick={handleContractClick}
>
  <Scale className="h-4 w-4" />
</Button>
```

### Query para Buscar Contrato

```sql
SELECT 
  zapsing_doctoken,
  status_document,
  signer_name,
  data_contrato,
  data_assinatura,
  cod_document
FROM vw_desempenho_julia_contratos
WHERE whatsapp = $1
  AND cod_agent::text = $2
ORDER BY data_contrato DESC
LIMIT 1
```

### Lógica de Download (reutilizada)

Para contratos assinados (`status_document = 'SIGNED'`):
- Usa edge function `zapsign-file` com `doc_token` e `file: 'signed'`
- Baixa o PDF diretamente

Para contratos em curso (`status_document = 'CREATED'`):
- Exibe botão "Abrir Contrato" que redireciona para o link do ZapSign
- Link extraído do campo `notes` no histórico ou construído via `cod_document`

---

## Fluxo de Interação

```text
1. Usuário vê card com ícone de balança brilhante (ciano ou verde)
2. Clica no ícone
3. Abre dialog com:
   - Status: "Contrato em Curso" ou "Contrato Assinado"
   - Nome do signatário
   - Datas
   - Botões:
     - Se em curso: "Abrir Contrato" (abre link ZapSign)
     - Se assinado: "Baixar Contrato" (download via proxy)
4. Dialog fecha ao clicar fora ou no X
```

---

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/crm/components/CRMLeadCard.tsx` | Remover badge, adicionar ícone Scale |
| `src/pages/crm/components/ContractInfoDialog.tsx` | **Criar** - Dialog de informações do contrato |
| `src/pages/crm/hooks/useContractInfo.ts` | **Criar** - Hook para buscar dados do contrato |
| `src/pages/crm/types.ts` | Adicionar interface `ContractInfo` |
