

# Plano: Adicionar Ícone de Status da Sessão no Popup de Mensagens

## Objetivo
Adicionar um ícone no header do popup de mensagens do WhatsApp (`WhatsAppMessagesDialog`) que, ao ser clicado, abre um novo popup mostrando o status de atendimento (`active` true/false) da sessão.

## Análise da Estrutura de Dados

A tabela `sessions` no banco externo possui os seguintes campos relevantes:
- `id`: bigint (PK)
- `agent_id`: bigint (FK para agents)
- `whatsapp_number`: bigint (número do WhatsApp sem formatação)
- `active`: boolean (indica se a sessão está ativa)
- `created_at`, `updated_at`: timestamps

## Arquivos a Modificar/Criar

### 1. Criar Novo Componente: `SessionStatusDialog.tsx`

**Caminho:** `src/pages/crm/components/SessionStatusDialog.tsx`

Novo componente Dialog que:
- Recebe `whatsappNumber`, `codAgent`, e estado de abertura (`open`/`onOpenChange`)
- Faz query no banco externo para buscar o status da sessão
- Exibe de forma visual se a sessão está `active: true` ou `active: false`
- Mostra informações adicionais como data de criação e última atualização

```text
┌──────────────────────────────────────┐
│  Status do Atendimento        [X]   │
├──────────────────────────────────────┤
│                                      │
│    🟢 Sessão Ativa                   │
│    ou                                │
│    🔴 Sessão Inativa                 │
│                                      │
│  WhatsApp: +55 11 99999-9999         │
│  Agente: 20250702                    │
│  Criado em: 28/01/2026 15:33         │
│  Atualizado em: 28/01/2026 16:45     │
│                                      │
└──────────────────────────────────────┘
```

### 2. Atualizar Componente: `WhatsAppMessagesDialog.tsx`

**Caminho:** `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

Modificações no header (linhas ~1082-1102):

**Antes:**
```typescript
<DialogHeader className="px-4 py-3 border-b bg-muted/30">
  <div className="flex items-center gap-3">
    <Avatar>...</Avatar>
    <div className="flex-1 min-w-0">
      <DialogTitle>...</DialogTitle>
      <p>...</p>
    </div>
  </div>
</DialogHeader>
```

**Depois:**
```typescript
<DialogHeader className="px-4 py-3 border-b bg-muted/30">
  <div className="flex items-center gap-3">
    <Avatar>...</Avatar>
    <div className="flex-1 min-w-0">
      <DialogTitle>...</DialogTitle>
      <p>...</p>
    </div>
    {/* Novo botão de status */}
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setStatusDialogOpen(true)}
      className="h-8 w-8"
    >
      <Bot className="h-5 w-5 text-muted-foreground hover:text-primary" />
    </Button>
  </div>
</DialogHeader>

{/* Novo dialog de status */}
<SessionStatusDialog
  open={statusDialogOpen}
  onOpenChange={setStatusDialogOpen}
  whatsappNumber={whatsappNumber}
  codAgent={codAgent}
/>
```

### 3. Adicionar Ação na Edge Function: `get_session_status`

**Caminho:** `supabase/functions/db-query/index.ts`

Nova ação para buscar o status da sessão:

```typescript
case 'get_session_status': {
  const { whatsappNumber, codAgent } = data;
  
  // Remove non-digits from whatsapp
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  
  result = await sql.unsafe(`
    SELECT 
      s.id,
      s.active,
      s.whatsapp_number::text,
      s.created_at,
      s.updated_at,
      a.cod_agent::text
    FROM sessions s
    JOIN agents a ON a.id = s.agent_id
    WHERE s.whatsapp_number::text = $1
      AND a.cod_agent::text = $2
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [cleanNumber, codAgent]);
  break;
}
```

### 4. Adicionar Método no `externalDb`

**Caminho:** `src/lib/externalDb.ts`

```typescript
async getSessionStatus(whatsappNumber: string, codAgent: string): Promise<SessionStatus | null> {
  const result = await this.invoke({
    action: 'get_session_status',
    data: { whatsappNumber, codAgent },
  });
  return result.length > 0 ? result[0] : null;
}
```

## Componente SessionStatusDialog - Detalhes

```typescript
interface SessionStatus {
  id: number;
  active: boolean;
  whatsapp_number: string;
  cod_agent: string;
  created_at: string;
  updated_at: string;
}

interface SessionStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  codAgent: string;
}
```

### Visual do Status

| Status | Cor | Ícone | Texto |
|--------|-----|-------|-------|
| `active: true` | Verde | Bot + círculo verde | "Atendimento Ativo" |
| `active: false` | Vermelho | Bot + círculo vermelho | "Atendimento Encerrado" |
| Sem sessão | Cinza | Bot + círculo cinza | "Sem Atendimento" |

## Fluxo de Funcionamento

```text
Usuário clica no ícone Bot no header
         ↓
SessionStatusDialog abre
         ↓
Faz query: externalDb.getSessionStatus(whatsapp, codAgent)
         ↓
Exibe resultado formatado com Badge colorido
```

## Impacto

- O popup de mensagens do WhatsApp terá um novo ícone no header
- Ao clicar, abrirá um popup secundário mostrando se o atendimento está ativo
- Usuários poderão verificar rapidamente o status de cada conversa
- Design consistente com o padrão do painel helena (ícone Bot com cores)

