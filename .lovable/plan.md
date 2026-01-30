
# Plano: Expandir Detalhes do Contrato no CRM

## Situacao Atual

A secao de contrato ja existe no dialog de detalhes do lead CRM, mas o popup de detalhes (`ContractInfoDialog`) mostra **informacoes limitadas** comparado com o popup da pagina de contratos Julia (`ContratoDetailsDialog`).

### Campos Atuais vs Campos Desejados

| Campo | Atual | Julia (Desejado) |
|-------|-------|------------------|
| Status | Sim | Sim |
| Signatario | Sim | Sim |
| Data contrato | Sim | Sim |
| Data assinatura | Sim | Sim |
| Codigo documento | Sim | Sim |
| CPF | Nao | Sim |
| WhatsApp | Nao | Sim |
| Endereco completo | Nao | Sim |
| Titulo do caso | Nao | Sim |
| Categoria | Nao | Sim |
| Resumo do caso | Nao | Sim |
| Agente responsavel | Nao | Sim |
| Situacao | Nao | Sim |

## Alteracoes Planejadas

### Etapa 1: Expandir Tipo ContractInfo

Adicionar todos os campos do `JuliaContrato` ao tipo `ContractInfo`:

```typescript
// src/pages/crm/types.ts
export interface ContractInfo {
  zapsing_doctoken?: string;
  status_document: string;
  signer_name?: string;
  signer_cpf?: string;
  signer_uf?: string;
  signer_cidade?: string;
  signer_bairro?: string;
  signer_endereco?: string;
  signer_cep?: string;
  data_contrato?: string;
  data_assinatura?: string;
  cod_document?: string;
  situacao?: string;
  resumo_do_caso?: string;
  case_title?: string;
  case_category_name?: string;
  case_category_color?: string;
  cod_agent?: string;
  agent_name?: string;
  business_name?: string;
  whatsapp?: string;
}
```

### Etapa 2: Atualizar Query do Hook

Buscar todos os campos da view `vw_desempenho_julia_contratos`:

```typescript
// src/pages/crm/hooks/useContractInfo.ts
const result = await externalDb.raw<ContractInfo>({
  query: `
    SELECT 
      zapsing_doctoken,
      status_document,
      signer_name,
      signer_cpf,
      signer_uf,
      signer_cidade,
      signer_bairro,
      signer_endereco,
      signer_cep,
      data_contrato,
      data_assinatura,
      cod_document,
      situacao,
      resumo_do_caso,
      case_title,
      case_category_name,
      case_category_color,
      cod_agent,
      name as agent_name,
      business_name,
      whatsapp
    FROM vw_desempenho_julia_contratos
    WHERE whatsapp = $1
      AND cod_agent::text = $2
    ORDER BY data_contrato DESC
    LIMIT 1
  `,
  params: [whatsappNumber, codAgent],
});
```

### Etapa 3: Redesenhar ContractInfoDialog

Transformar o dialog simples em um popup completo igual ao `ContratoDetailsDialog`:

**Estrutura do novo dialog:**
```text
┌─────────────────────────────────────────────────────────┐
│ Detalhes do Contrato                                [X] │
├─────────────────────────────────────────────────────────┤
│ Informacoes do Contrato                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Codigo: ABC123         Status: [Assinado]          │ │
│ │ Situacao: Ativo        Data: 30/01/2026            │ │
│ │                        [Baixar Contrato]           │ │
│ └─────────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────── │
│ Dados do Signatario                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Nome: Maria Silva      CPF: 123.456.789-00         │ │
│ │ WhatsApp: (11) 99999-9999                          │ │
│ └─────────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────── │
│ Endereco                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Rua ABC, 123 - Centro                              │ │
│ │ Sao Paulo - SP, 01234-567                          │ │
│ └─────────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────── │
│ Vinculo com Processo                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Titulo: Acao Trabalhista                           │ │
│ │ Categoria: [Trabalhista]                           │ │
│ └─────────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────── │
│ Resumo do Caso                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Cliente busca indenizacao por demissao sem justa   │ │
│ │ causa apos 5 anos de servico...                    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────────── │
│ Agente Responsavel                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Codigo: AGT001         Nome: Dr. Joao              │ │
│ │ Escritorio: Advocacia Silva & Associados           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Etapa 4: Ajustar Botoes na Secao de Contrato

Atualizar os botoes no `CRMLeadDetailsDialog` para:

**Contrato Assinado:**
- "Baixar Contrato" (download do PDF)
- "Ver Detalhes" (popup com todas as informacoes)

**Contrato em Curso:**
- "Ver Documentos" (abre pagina do ZapSign para assinar/verificar)
- "Ver Detalhes" (popup com todas as informacoes)

```typescript
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => setContractDialogOpen(true)}>
    <Scale className="h-4 w-4 mr-2" />
    Ver Detalhes
  </Button>
  
  {contractInfo?.status_document === 'SIGNED' && contractInfo.zapsing_doctoken ? (
    <Button size="sm" onClick={handleDownloadContract} disabled={downloading}>
      {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
      Baixar Contrato
    </Button>
  ) : contractInfo?.cod_document ? (
    <Button size="sm" onClick={handleOpenContract}>
      <ExternalLink className="h-4 w-4 mr-2" />
      Ver Documentos
    </Button>
  ) : null}
</div>
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/crm/types.ts` | Expandir interface ContractInfo com todos os campos |
| `src/pages/crm/hooks/useContractInfo.ts` | Atualizar query para buscar todos os campos |
| `src/pages/crm/components/ContractInfoDialog.tsx` | Redesenhar igual ao ContratoDetailsDialog |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Adicionar botao "Ver Documentos" para contratos em curso |

## Beneficios

1. **Paridade de funcionalidade** - Mesmas informacoes da pagina de contratos Julia
2. **Botao contextual** - Download para assinados, ver documentos para em curso
3. **Experiencia completa** - Usuario nao precisa ir para outra pagina
4. **Reutilizacao de codigo** - Mesma estrutura visual do ContratoDetailsDialog
