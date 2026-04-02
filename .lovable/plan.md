

# Nova Etapa de Contrato no Fluxo de Compra

## Resumo

Adicionar uma etapa "Contrato" entre "Plano" e "Pagamento" no fluxo `/comprar`. O contrato será exibido em Markdown scrollável, com checkbox obrigatório de aceite. O texto do contrato ficará armazenado no banco (tabela `julia_contract_template`) para fácil edição pelo admin.

## Alterações

### 1. Migração SQL — Tabela `julia_contract_template`

Criar tabela com uma única linha editável contendo o texto do contrato em Markdown:

```sql
CREATE TABLE julia_contract_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Contrato de Licença de Uso',
  body_markdown text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE julia_contract_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON julia_contract_template FOR SELECT USING (true);
CREATE POLICY "Public write" ON julia_contract_template FOR ALL USING (true) WITH CHECK (true);
```

Inserir o conteúdo do PDF enviado como seed inicial (todo o texto do contrato convertido para Markdown, com placeholders como `{{customer_name}}`, `{{customer_document}}`, `{{plan_name}}`, etc.)

### 2. `ComprarPage.tsx` — Adicionar etapa 4 (Contrato)

- Steps passa de 4 para 5: `['Documento', 'Dados', 'Plano', 'Contrato', 'Pagamento']`
- `nextStep` max = 4, novo step index: Contrato = 3, Pagamento = 4
- Renderizar `ContractStep` no step 3 e `CheckoutStep` no step 4

### 3. Novo componente `ContractStep.tsx`

- Busca o `body_markdown` da tabela `julia_contract_template`
- Substitui placeholders (`{{customer_name}}`, `{{customer_document}}`, `{{customer_email}}`, `{{customer_whatsapp}}`, `{{customer_address}}`, `{{plan_name}}`, `{{plan_price}}`, `{{billing_period}}`) com dados do `orderData`
- Renderiza o Markdown com `react-markdown` dentro de um container scrollável (max-h ~400px, overflow-y-auto)
- Checkbox obrigatório: "Li e aceito os termos do contrato"
- Botão "Continuar" desabilitado até checkbox marcado
- Botões Voltar / Continuar

### 4. Admin — Página de edição do contrato

- Adicionar módulo no admin (rota `/admin/contrato-template` ou similar)
- Textarea grande para editar o `body_markdown`
- Preview ao lado (ou abaixo) renderizado com `react-markdown`
- Botão salvar que faz `UPDATE` na linha existente

### Arquivos alterados/criados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar `julia_contract_template` + seed com conteúdo do PDF |
| `src/pages/comprar/ComprarPage.tsx` | 5 etapas, novo step Contrato |
| `src/pages/comprar/steps/ContractStep.tsx` | **Novo** — exibe contrato + checkbox aceite |
| `src/pages/admin/contrato/ContratoTemplatePage.tsx` | **Novo** — edição do template do contrato |
| Registro de rota admin | Adicionar rota e menu |

