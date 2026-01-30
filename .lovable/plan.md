
# Plano: Adicionar Links de Contrato no Detalhes do Lead CRM

## Objetivo

Quando o lead estiver nas etapas **"Contrato em Curso"** ou **"Contrato Assinado"**, exibir no dialog de detalhes do CRM os mesmos botoes que existem na lista de contratos da Julia:
1. **Botao de Download** - Baixar contrato assinado (somente para contratos assinados)
2. **Botao de Detalhes** - Abrir popup com informacoes completas do contrato

## Componentes Existentes que Serao Reutilizados

| Componente | Funcao |
|------------|--------|
| `ContractInfoDialog` | Popup de detalhes do contrato - ja existe e funciona |
| `useContractInfo` | Hook para buscar dados do contrato por whatsapp/cod_agent |
| Logica de download | Mesma usada em `ContratosTable` e `ContractInfoDialog` |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Adicionar secao de contrato com botoes |

## Implementacao Detalhada

### Etapa 1: Adicionar Imports Necessarios

```typescript
import { Scale, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContractInfoDialog } from './ContractInfoDialog';
import { useContractInfo } from '../hooks/useContractInfo';
```

### Etapa 2: Detectar se o Card Esta em Etapa de Contrato

Verificar pelo nome do stage se o lead esta em "Contrato em Curso" ou "Contrato Assinado":

```typescript
const isContractStage = currentStage?.name === 'Contrato em Curso' || 
                        currentStage?.name === 'Contrato Assinado';
```

### Etapa 3: Adicionar Estados para Dialog e Download

```typescript
const [contractDialogOpen, setContractDialogOpen] = useState(false);
const [downloading, setDownloading] = useState(false);
```

### Etapa 4: Buscar Dados do Contrato Condicionalmente

Usar o hook existente para buscar informacoes do contrato apenas quando necessario:

```typescript
const { data: contractInfo, isLoading: contractLoading } = useContractInfo(
  card?.whatsapp_number || '',
  card?.cod_agent || '',
  isContractStage && open
);
```

### Etapa 5: Adicionar Funcao de Download

Reutilizar a mesma logica de download existente em `ContratosTable`:

```typescript
const handleDownloadContract = async () => {
  if (!contractInfo?.zapsing_doctoken) {
    toast({ title: 'Erro', description: 'Contrato sem token para download', variant: 'destructive' });
    return;
  }
  
  setDownloading(true);
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapsign-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ doc_token: contractInfo.zapsing_doctoken, file: 'signed' }),
    });
    
    // ... processar blob e download ...
  } finally {
    setDownloading(false);
  }
};
```

### Etapa 6: Adicionar UI de Contrato no Dialog

Nova secao entre "Fase Atual" e "Observacoes":

```typescript
{/* Contract Actions - Apenas para etapas de contrato */}
{isContractStage && (
  <>
    <Separator />
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4" />
        Contrato
      </h4>
      <div className="flex gap-2">
        {/* Botao Ver Detalhes */}
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setContractDialogOpen(true)}
        >
          <Scale className="h-4 w-4 mr-2" />
          Ver Detalhes
        </Button>
        
        {/* Botao Download - somente se SIGNED */}
        {contractInfo?.status_document === 'SIGNED' && contractInfo.zapsing_doctoken && (
          <Button
            size="sm"
            className="flex-1"
            onClick={handleDownloadContract}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar Contrato
          </Button>
        )}
      </div>
    </div>
  </>
)}
```

### Etapa 7: Adicionar ContractInfoDialog no JSX

```typescript
{/* Contract Details Dialog */}
<ContractInfoDialog
  open={contractDialogOpen}
  onOpenChange={setContractDialogOpen}
  whatsappNumber={card.whatsapp_number}
  codAgent={card.cod_agent}
  contactName={card.contact_name}
/>
```

## Layout Visual Final

Quando o lead estiver em etapa de contrato, aparecera:

```text
┌─────────────────────────────────────────┐
│ Detalhes do Lead                    [X] │
├─────────────────────────────────────────┤
│ Nome: Maria Silva                       │
│ WhatsApp: (11) 99999-9999              │
│ Empresa: Acme Corp                      │
│ ...                                     │
├─────────────────────────────────────────┤
│ Fase Atual                              │
│ [Contrato Assinado]  desde 30/01/2026   │
├─────────────────────────────────────────┤
│ 📜 Contrato                             │ ← NOVA SECAO
│ [Ver Detalhes] [Baixar Contrato]        │
├─────────────────────────────────────────┤
│ Historico de Movimentacoes              │
│ ...                                     │
└─────────────────────────────────────────┘
```

## Logica de Exibicao dos Botoes

| Etapa | Botao Detalhes | Botao Download |
|-------|----------------|----------------|
| Contrato em Curso | Visivel | Oculto |
| Contrato Assinado | Visivel | Visivel (se tiver token) |
| Outras etapas | Oculto | Oculto |

## Beneficios

1. **Reutilizacao** - Usa os mesmos componentes e hooks ja existentes
2. **Consistencia** - Mesma experiencia da lista de contratos Julia
3. **Condicional** - Botoes so aparecem quando fazem sentido
4. **Feedback visual** - Loading states durante download
