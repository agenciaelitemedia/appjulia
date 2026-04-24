## Objetivo
No header do `WhatsAppMessagesDialog` (popup de chat do CRM em `/crm/leads`), identificar visualmente se o agente envia mensagens via **UaZapi direto** (credenciais próprias na tabela `agents`) ou via **Fila vinculada** (`queue_agent_links` → `queues`), através de:

1. **Cor do ícone do avatar** ao lado do nome/telefone:
   - 🟢 Verde (já é o atual `bg-green-600`) → conexão **UaZapi direta**.
   - 🔵 Azul (`bg-blue-600`) → conexão via **Fila vinculada** (UaZapi ou WABA).
2. **Badge** logo abaixo do número de telefone com o nome da origem:
   - Se vínculo com fila: `queues.name` (ex: "Atendimento Comercial").
   - Se direto: `evo_instance` (ou "UaZapi" como fallback).
   - Cor do badge espelhando a cor do avatar (verde/azul).

## Como detectar a origem
Já existe na consulta atual (`loadAgentCredentials`) o `hub`, `evo_instance`, `waba_id`, etc. Falta consultar o vínculo do agente com filas:

```sql
SELECT q.id, q.name, q.channel_type, q.hub
FROM queue_agent_links qal
JOIN queues q ON q.id = qal.queue_id
WHERE qal.cod_agent = $1
  AND q.is_active = true
  AND COALESCE(q.is_deleted, false) = false
ORDER BY qal.is_primary DESC NULLS LAST, q.created_at ASC
LIMIT 1;
```

- Se retornar **0 linhas** → conexão direta → cor **verde** + badge com `evo_instance` (ou "UaZapi").
- Se retornar **1+ linhas** → vínculo com fila → cor **azul** + badge com `queue.name`.

Observação: como o popup do CRM é client-side e a tabela `queue_agent_links` está no Supabase (público), a query pode ser feita pelo client `supabase` diretamente — não precisa passar pelo `externalDb`. Já existe o hook reaproveitável `useQueueAgentLink` (lê apenas por `queueId`); criaremos um irmão por `cod_agent`.

## Mudanças de código (1 hook novo + 1 edição no popup)

### 1. `src/hooks/useAgentQueueLink.ts` (NOVO)
Hook React Query que recebe `cod_agent` e retorna:
```ts
{
  source: 'queue' | 'direct',
  queueName: string | null,   // quando source === 'queue'
  queueId: string | null,
  channelType: string | null,  // 'uazapi' | 'waba' | ...
}
```
Faz `select` em `queue_agent_links` join `queues` ativo/não-deletado, ordenado por `is_primary desc`. Stale 5 min.

### 2. `src/pages/crm/components/WhatsAppMessagesDialog.tsx` (EDIÇÃO)
Linhas ~1723-1762 (header/avatar/título/telefone):

- Importar `useAgentQueueLink` e `Badge`.
- Chamar o hook com `codAgent` quando `open && codAgent`.
- Computar:
  ```ts
  const isViaQueue = agentLink?.source === 'queue';
  const avatarBg = isViaQueue ? 'bg-blue-600' : 'bg-green-600';
  const sourceLabel = isViaQueue
    ? agentLink.queueName
    : (evoInstance || 'UaZapi');
  ```
- Trocar as classes do `<Avatar>` e `<AvatarFallback>` (linhas 1725-1726) para usar `avatarBg`.
- Após o `<p className="text-xs text-muted-foreground">{whatsappNumber}</p>` (linha 1759-1761), adicionar:
  ```tsx
  {sourceLabel && (
    <Badge
      variant="secondary"
      className={cn(
        'mt-0.5 text-[10px] px-1.5 py-0 h-4 font-medium text-white border-0',
        isViaQueue ? 'bg-blue-600 hover:bg-blue-600' : 'bg-green-600 hover:bg-green-600'
      )}
    >
      {isViaQueue ? '📥 ' : '🔗 '}{sourceLabel}
    </Badge>
  )}
  ```
- Para acessar `evoInstance` no header: já é carregado em `loadAgentCredentials` (linha 1240). Vamos guardar `evo_instance` em um state novo `agentInstance` (atualmente é descartado) — pequena edição no setter para também persistir o valor.

## Comportamento esperado
- Agente sem fila vinculada (UaZapi próprio): avatar **verde** + badge verde "🔗 nome-da-instancia" (ou "UaZapi").
- Agente vinculado a uma fila UaZapi: avatar **azul** + badge azul "📥 QUEUE_..." com o nome da fila.
- Agente vinculado a uma fila WABA: avatar **azul** + badge azul "📥 Meta Official" (ou nome configurado).
- Loading: mantém o verde atual até o hook resolver (no flicker), badge só aparece quando há valor.

## Arquivos
- **Criar**: `src/hooks/useAgentQueueLink.ts`
- **Editar**: `src/pages/crm/components/WhatsAppMessagesDialog.tsx` (header + persistir `evo_instance` em state)

## Não faz parte deste plano
- Mudar lógica de envio (continua usando o `provider`/`client` já calculado em `loadAgentCredentials`).
- Alterar outras telas (chat omnichannel, atendimento humano) — escopo restrito ao popup do CRM.
- Permitir trocar a fila pela UI.

Confirma para implementar?