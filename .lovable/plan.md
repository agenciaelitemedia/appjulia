

# Excluir contrato da Julia com dupla confirmação e auditoria

## Resumo

Adicionar botão X (excluir) na tabela de contratos da Julia. Ao clicar, abre dialog de dupla confirmação (digitar telefone + switch). Ao confirmar, atualiza `status_document` para `DELETED` no banco externo e grava auditoria em tabela Supabase.

## 1. Migração: tabela `contract_deletion_audit`

```sql
CREATE TABLE contract_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_document text NOT NULL,
  cod_agent text,
  signer_name text,
  whatsapp text,
  previous_status text,
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
ALTER TABLE contract_deletion_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contract_deletion_audit" ON contract_deletion_audit FOR ALL USING (true) WITH CHECK (true);
```

## 2. `src/pages/estrategico/contratos/components/ContratosTable.tsx`

- Importar `X`, `AlertTriangle` de lucide e componentes de AlertDialog, Input, Switch
- Adicionar estados: `deleteDialogOpen`, `deleteContrato`, `deleteConfirmPhone`, `deleteConfirmSwitch`
- Adicionar botão X vermelho na coluna de ações (após o Eye), com tooltip "Excluir contrato"
- AlertDialog com:
  - Icone de alerta e mensagem em destaque: "Esta ação é irreversível. O contrato será permanentemente removido e não poderá ser desfeito. Você não terá mais acesso a este contrato. Esta ação será auditada."
  - Input para digitar o telefone do contrato
  - Switch "Confirmo que desejo excluir"
  - Botão "Excluir definitivamente" habilitado apenas quando telefone bate e switch ativo
- Ao confirmar:
  1. `externalDb.raw` com `UPDATE ... SET status_document = 'DELETED' WHERE cod_document = $1`
  2. `supabase.from('contract_deletion_audit').insert(...)` com dados do contrato
  3. Invalidar queries de contratos
  4. Toast de sucesso

## 3. Filtro de status

- Adicionar `DELETED` ao `statusConfig` em `ContratosTable` (badge cinza escuro)
- Os contratos deletados continuam na view mas com status DELETED — se desejado, podem ser filtrados

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar tabela `contract_deletion_audit` |
| `ContratosTable.tsx` | Botão X + AlertDialog dupla confirmação + lógica de exclusão |

