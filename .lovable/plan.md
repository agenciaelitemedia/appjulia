
# Plano de Implementacao: Melhorias Contratos Julia

## Resumo das Alteracoes

| Item | Descricao | Arquivos Afetados |
|------|-----------|-------------------|
| 1 | Remover colunas e formatar WhatsApp | ContratosTable.tsx |
| 2 | Adicionar tempo de assinatura/em curso | ContratosTable.tsx, dateUtils.ts |
| 3 | Popup WhatsApp igual ao CRM | ContratosTable.tsx |
| 4 | Download de contrato via ZapSign API | Nova Edge Function + ContratosTable.tsx |

---

## 1. Remover Colunas e Formatar WhatsApp

### Alteracoes em `ContratosTable.tsx`

**Remover colunas:**
- Linha 90: Remover `<TableHead>Situacao</TableHead>`
- Linha 92: Remover `<TableHead>Assinatura</TableHead>`
- Linhas 131-135: Remover celula de Situacao
- Linhas 139-143: Remover celula de Assinatura

**Formatar numero WhatsApp:**

Adicionar funcao helper:
```typescript
function formatWhatsAppNumber(number: string): string {
  if (!number) return '-';
  
  // Remove todos os caracteres nao numericos
  const cleaned = number.replace(/\D/g, '');
  
  // Formato: +55 (34) 99999-9999
  if (cleaned.length === 13) {
    // Com codigo do pais (55) + DDD (2) + numero (9)
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12) {
    // Com codigo do pais (55) + DDD (2) + numero (8)
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  } else if (cleaned.length === 11) {
    // Apenas DDD (2) + numero (9)
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // Apenas DDD (2) + numero (8)
    return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return number;
}
```

**Atualizar celula WhatsApp (linha 116-124):**
```typescript
<TableCell>
  <a
    href={`https://wa.me/${contrato.whatsapp?.replace(/\D/g, '')}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary hover:underline font-mono text-sm"
  >
    {formatWhatsAppNumber(contrato.whatsapp)}
  </a>
</TableCell>
```

---

## 2. Adicionar Tempo de Assinatura/Em Curso

### Adicionar helper em `dateUtils.ts`

```typescript
/**
 * Calcula a diferenca de tempo entre duas datas e retorna string amigavel.
 * Exemplos: "em 3 min", "ha 50 min", "ha 2 dias", "em 1h 23min"
 */
export function formatTimeDifference(
  startDate: string | Date, 
  endDate?: string | Date | null
): string {
  const start = parseDbTimestamp(startDate);
  const end = endDate ? parseDbTimestamp(endDate) : new Date();
  
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Determina prefixo: "em" para passado (assinado), "ha" para em curso
  const prefix = endDate ? 'em' : 'ha';
  
  if (diffDays > 0) {
    return `${prefix} ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }
  
  if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `${prefix} ${diffHours}h ${remainingMinutes}min`;
    }
    return `${prefix} ${diffHours}h`;
  }
  
  return `${prefix} ${diffMinutes} min`;
}
```

### Atualizar celula de Status em `ContratosTable.tsx`

Modificar linhas 126-130 para incluir tempo abaixo do badge:

```typescript
<TableCell>
  <div className="flex flex-col gap-1">
    <Badge variant="secondary" className={statusInfo.className}>
      {statusInfo.label}
    </Badge>
    <span className="text-[10px] text-muted-foreground">
      {contrato.status_document === 'SIGNED' 
        ? formatTimeDifference(contrato.data_contrato, contrato.data_assinatura)
        : formatTimeDifference(contrato.data_contrato)
      }
    </span>
  </div>
</TableCell>
```

**Exemplos de exibicao:**
- Contrato SIGNED: Badge "Assinado" + "em 3 min" (tempo entre criacao e assinatura)
- Contrato CREATED/PENDING: Badge "Criado" + "ha 50 min" (tempo desde criacao ate agora)

---

## 3. Adicionar Popup WhatsApp (igual ao CRM)

### Modificar `ContratosTable.tsx`

**Adicionar imports:**
```typescript
import { useState } from 'react'; // Adicionar useState
import { MessageCircle } from 'lucide-react'; // Adicionar icone
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

**Adicionar estado para controlar dialog:**
```typescript
const [messagesOpen, setMessagesOpen] = useState(false);
const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);

const handleOpenMessages = (contrato: JuliaContrato) => {
  setSelectedContrato(contrato);
  setMessagesOpen(true);
};
```

**Atualizar coluna Acoes (linha 93):**
```typescript
<TableHead className="w-[120px]">Acoes</TableHead>
```

**Atualizar celula de Acoes (linhas 144-152):**
```typescript
<TableCell>
  <div className="flex items-center gap-1">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/50"
            onClick={() => handleOpenMessages(contrato)}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ver mensagens do WhatsApp</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewDetails(contrato)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ver detalhes</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</TableCell>
```

**Adicionar dialog no final do componente (antes do fechamento do div raiz):**
```typescript
{selectedContrato && (
  <WhatsAppMessagesDialog
    open={messagesOpen}
    onOpenChange={setMessagesOpen}
    whatsappNumber={selectedContrato.whatsapp}
    leadName={selectedContrato.signer_name || ''}
    codAgent={selectedContrato.cod_agent}
  />
)}
```

---

## 4. Download de Contrato via ZapSign API

### 4.1 Criar Secret para API Token do ZapSign

Sera necessario adicionar o secret `ZAPSIGN_API_TOKEN` via Lovable.

### 4.2 Criar Edge Function `zapsign-download`

**Arquivo:** `supabase/functions/zapsign-download/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doc_token } = await req.json();
    
    if (!doc_token) {
      throw new Error('doc_token is required');
    }

    const apiToken = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!apiToken) {
      throw new Error('ZAPSIGN_API_TOKEN not configured');
    }

    // Chamar API ZapSign para obter detalhes do documento
    // Endpoint: GET https://api.zapsign.com.br/api/v1/docs/{doc_token}/
    const response = await fetch(
      `https://api.zapsign.com.br/api/v1/docs/${doc_token}/`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ZapSign API error:', errorData);
      throw new Error(`ZapSign API error: ${response.status}`);
    }

    const docData = await response.json();
    
    // Retornar URL do documento assinado (ou original se ainda nao assinado)
    // IMPORTANTE: Este link expira em 60 minutos
    const result = {
      success: true,
      signed_file: docData.signed_file || null,
      original_file: docData.original_file || null,
      status: docData.status,
      name: docData.name,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('ZapSign download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### 4.3 Adicionar Botao de Download em `ContratosTable.tsx`

**Adicionar import:**
```typescript
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
```

**Adicionar estado para download:**
```typescript
const { toast } = useToast();
const [downloadingId, setDownloadingId] = useState<string | null>(null);

const handleDownloadContract = async (contrato: JuliaContrato) => {
  if (!contrato.cod_document) {
    toast({
      title: 'Erro',
      description: 'Documento nao possui codigo identificador',
      variant: 'destructive',
    });
    return;
  }

  setDownloadingId(contrato.cod_document);

  try {
    const { data, error } = await supabase.functions.invoke('zapsign-download', {
      body: { doc_token: contrato.cod_document },
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Erro ao obter documento');
    }

    // Prioriza documento assinado, senao usa original
    const fileUrl = data.signed_file || data.original_file;
    
    if (!fileUrl) {
      toast({
        title: 'Documento indisponivel',
        description: 'O documento ainda nao esta disponivel para download',
        variant: 'destructive',
      });
      return;
    }

    // Abrir em nova aba (o link ja e do S3 e faz download automatico)
    window.open(fileUrl, '_blank');
    
    toast({
      title: 'Download iniciado',
      description: 'O documento sera baixado em instantes',
    });

  } catch (error) {
    console.error('Erro ao baixar contrato:', error);
    toast({
      title: 'Erro ao baixar',
      description: error instanceof Error ? error.message : 'Erro desconhecido',
      variant: 'destructive',
    });
  } finally {
    setDownloadingId(null);
  }
};
```

**Adicionar botao na celula de Acoes:**
```typescript
{/* Botao Download - apenas para contratos assinados */}
{contrato.status_document === 'SIGNED' && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
          onClick={() => handleDownloadContract(contrato)}
          disabled={downloadingId === contrato.cod_document}
        >
          {downloadingId === contrato.cod_document ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Baixar contrato assinado</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

---

## Estrutura Final da Tabela

```text
┌──────────────┬─────────────────┬──────────────────────┬───────────────────┬──────────────────┬───────────────────┐
│ Agente       │ Cliente         │ WhatsApp             │ Status            │ Data Contrato    │ Acoes             │
├──────────────┼─────────────────┼──────────────────────┼───────────────────┼──────────────────┼───────────────────┤
│ [1001]       │ Joao Silva      │ +55 (34) 99999-9999  │ ┌─────────────┐   │ 23/01/26, 14:30  │ [💬] [📥] [👁]   │
│ Escritorio A │                 │                      │ │  Assinado   │   │                  │                   │
│              │                 │                      │ └─────────────┘   │                  │                   │
│              │                 │                      │   em 3 min        │                  │                   │
├──────────────┼─────────────────┼──────────────────────┼───────────────────┼──────────────────┼───────────────────┤
│ [1002]       │ Maria Santos    │ +55 (11) 98888-8888  │ ┌─────────────┐   │ 23/01/26, 10:00  │ [💬] [👁]        │
│ Escritorio B │                 │                      │ │   Criado    │   │                  │                   │
│              │                 │                      │ └─────────────┘   │                  │                   │
│              │                 │                      │   ha 4h 30min     │                  │                   │
└──────────────┴─────────────────┴──────────────────────┴───────────────────┴──────────────────┴───────────────────┘
```

**Legenda Acoes:**
- 💬 = Ver mensagens WhatsApp (abre popup)
- 📥 = Baixar contrato (apenas para SIGNED)
- 👁 = Ver detalhes

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/dateUtils.ts` | Adicionar `formatTimeDifference()` |
| `src/pages/estrategico/contratos/components/ContratosTable.tsx` | Todas as alteracoes de UI |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/zapsign-download/index.ts` | Edge Function para API ZapSign |

## Secrets a Configurar

| Secret | Descricao |
|--------|-----------|
| `ZAPSIGN_API_TOKEN` | Token da API ZapSign (Bearer) |

---

## Ordem de Implementacao

1. Adicionar secret `ZAPSIGN_API_TOKEN`
2. Criar Edge Function `zapsign-download`
3. Atualizar `dateUtils.ts` com `formatTimeDifference()`
4. Atualizar `ContratosTable.tsx`:
   - Remover colunas Situacao e Assinatura
   - Adicionar formatacao WhatsApp
   - Adicionar tempo abaixo do status
   - Adicionar botao WhatsApp com popup
   - Adicionar botao download
5. Deploy da Edge Function
6. Testar fluxo completo

---

## Notas Tecnicas

### ZapSign API
- **Endpoint:** `GET https://api.zapsign.com.br/api/v1/docs/{doc_token}/`
- **Autenticacao:** Bearer Token
- **Campos retornados:** `signed_file`, `original_file`, `status`, `name`
- **IMPORTANTE:** URLs expiram em 60 minutos - por isso chamamos a API sob demanda

### Mapeamento de Dados
- `cod_document` do banco = `doc_token` na API ZapSign
- O campo `cod_document` ja contem o UUID do documento ZapSign

### Compatibilidade
- O `WhatsAppMessagesDialog` ja funciona com `codAgent` para buscar credenciais dinamicamente
- O campo `whatsapp` do contrato esta no mesmo formato usado pelo CRM
