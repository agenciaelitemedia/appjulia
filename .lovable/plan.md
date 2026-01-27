
## Ajustes na Página "Meus Agentes" e Integração UaZapi

### Situação Atual

O projeto já possui uma **implementação completa e robusta do UaZapi** em `src/lib/uazapi/`:
- Cliente HTTP com retry e timeout (`client.ts`)
- Tipos TypeScript completos (`types.ts`)
- Endpoints organizados: Instance, Message, Chat, Business, Agent, Labels, Group, Call, Chatwoot
- Context Provider (`UaZapiContext.tsx`) 
- Hook de acesso (`useUaZapi.ts`)

O repositório de referência possui estrutura similar, então não há necessidade de copiar - apenas utilizar o que já existe.

**Problema Identificado**: O erro `column a.evo_instancia does not exist` indica que o nome da coluna no banco é diferente (provavelmente `evo_instance` em inglês).

---

## Mudanças a Implementar

### 1. Corrigir nome da coluna na Edge Function

**Arquivo:** `supabase/functions/db-query/index.ts`

**Ação `get_user_agents` (linhas 366-395):**

Corrigir o nome da coluna de `a.evo_instancia` para `a.evo_instance` (ou verificar o nome correto):

```sql
SELECT 
  ua.agent_id,
  ua.cod_agent::text as cod_agent,
  a.id as agent_id_from_agents,
  a.status,
  a.hub,
  a.evo_url,
  a.evo_apikey,
  a.evo_instance as evo_instancia,  -- Alias para manter compatibilidade com frontend
  c.name as client_name,
  c.business_name,
  ...
```

---

### 2. Ajustar layout do AgentCard

**Arquivo:** `src/pages/agente/meus-agentes/components/AgentCard.tsx`

**Layout atual:**
```text
| [Bot] Ativo             #cod_agent |
| [Conexão Badge]                    |
|                                    |
| Nome do Agente                     |
```

**Novo layout:**
```text
| [Bot] Ativo    [Conexão Badge]    |
|                                    |
| Nome do Agente                     |
| #cod_agent                         |
```

Mudanças específicas:
- Mover `ConnectionStatusBadge` para o lado direito do header (onde estava o cod_agent)
- Mover `#cod_agent` para baixo do nome do agente
- Manter a instância WhatsApp abaixo do código

**Código proposto:**
```tsx
<Card className="hover:shadow-md transition-shadow">
  <CardContent className="p-4">
    {/* Header com badges */}
    <div className="flex items-start justify-between mb-3">
      {/* Lado esquerdo: ícone + status ativo */}
      <div className="flex items-center gap-2">
        {isMonitored ? (
          <Eye className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
        <Badge variant={agent.status ? "default" : "secondary"}>
          {agent.status ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>
      {/* Lado direito: badge de conexão WhatsApp */}
      <ConnectionStatusBadge status={connectionStatus} isLoading={isLoading} />
    </div>

    {/* Nome */}
    <h3 className="font-semibold text-foreground mb-1 truncate">
      {agent.business_name || agent.client_name || 'Sem nome'}
    </h3>
    
    {/* Código do agente - agora abaixo do nome */}
    <p className="text-xs text-muted-foreground font-mono mb-2">
      #{agent.cod_agent}
    </p>

    {/* Instância WhatsApp */}
    {agent.evo_instancia && (
      <p className="text-xs text-muted-foreground mb-2 truncate">
        Instância: {agent.evo_instancia}
      </p>
    )}

    {/* ... resto do card ... */}
  </CardContent>
</Card>
```

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/db-query/index.ts` | Corrigir nome da coluna `evo_instance` → alias `evo_instancia` |
| `src/pages/agente/meus-agentes/components/AgentCard.tsx` | Reposicionar badge de conexão (direita) e cod_agent (abaixo do nome) |

---

## Resultado Visual Esperado

```text
+-----------------------------------------------+
| [🤖] Ativo               [🟢 Conectado]       |
|                                               |
|   Escritório XYZ                              |
|   #20250901                                   |
|   Instância: minha-instancia                  |
|   Plano: Premium                              |
|                                               |
|   Leads: 45/100 este mês                      |
|   ████████░░░░░░░░░░░  45%                    |
+-----------------------------------------------+
```

---

## Sobre a Biblioteca UaZapi

A biblioteca existente em `src/lib/uazapi/` já está **completa e bem estruturada**, cobrindo todos os endpoints do repositório de referência:

- **Instance**: status, QR code, connect, disconnect, restart
- **Message**: text, image, video, audio, document, sticker, location, contact, buttons, list
- **Chat**: archive, block, delete, find, labels, mute, pin, read
- **Business**: catalog, profile
- **Agent**: AI agent configuration
- **Group**: communities, participants
- **Labels**: CRUD de etiquetas
- **Chatwoot**: integração

Não é necessário copiar código do repositório de referência - basta utilizar o hook `useUaZapi()` onde for necessário.
