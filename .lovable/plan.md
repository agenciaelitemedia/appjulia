

# Redesign Colaboradores Julia + Perfil WhatsApp no Status

## Resumo

Duas mudanças:
1. Redesign do card "Colaboradores Julia" com transfer list usando usuários `admin` e `colaborador` do banco externo
2. Exibir informações completas do perfil WhatsApp conectado no card "Status da Conexão"

## 1. Migração: colunas extras em `support_team_members`

```sql
ALTER TABLE public.support_team_members 
ADD COLUMN IF NOT EXISTS user_id integer,
ADD COLUMN IF NOT EXISTS email text DEFAULT '',
ADD COLUMN IF NOT EXISTS role text DEFAULT '';
```

## 2. Redesign `SupportTeamConfig.tsx` — Transfer List

### Fonte de dados

Usar `externalDb.getUsersWithPermissions()` para buscar todos os usuários, depois filtrar **apenas** `role === 'admin'` ou `role === 'colaborador'` no client-side. Cruzar com `support_team_members` para separar disponíveis vs selecionados.

### Layout

```text
┌─────────────────────────────────────────────────────────┐
│  Colaboradores Julia                                     │
│  Selecione os usuários que atuam nos grupos de suporte   │
├──────────────────────────┬──────────────────────────────┤
│  Disponíveis          🔍 │  Selecionados (3)            │
│ ┌──────────────────────┐ │ ┌──────────────────────────┐ │
│ │ João Silva           │ │ │ Ana Souza          [x]   │ │
│ │ joao@email.com       │ │ │ ana@email.com            │ │
│ │ [Admin]       [+]    │ │ │ [Colaborador]            │ │
│ └──────────────────────┘ │ └──────────────────────────┘ │
└──────────────────────────┴──────────────────────────────┘
```

### Comportamento

- Filtro por nome/email em cada lista
- Clicar `+` → insert em `support_team_members` (com `user_id`, `name`, `email`, `role`, `phone` vazio)
- Clicar `x` → delete de `support_team_members`
- Campo `phone` editável inline nos selecionados (necessário para identificar mensagens)
- Badges: `admin` → vermelho, `colaborador` → azul
- Optimistic UI

## 3. Perfil WhatsApp no "Status da Conexão"

Quando `connection_status === 'connected'`, fazer fetch direto a `{api_url}/instance/info` e `/instance/status` (mesma lógica do `useConnectedPhoneInfo`) para extrair e exibir no card:

- **Foto de perfil** (Avatar)
- **Nome do perfil** (pushName / profileName)
- **Número do telefone** (owner / jid)
- **Nome da instância** (instance.name)
- **Status** (connected/loggedIn)
- **Plataforma** (platform, se disponível)

Exibir abaixo do badge de status com layout compacto (Avatar + dados ao lado).

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migração SQL | Adicionar colunas `user_id`, `email`, `role` |
| `SupportTeamConfig.tsx` | Redesign completo com transfer list |
| `SupportAssistantPage.tsx` | Adicionar fetch de perfil WhatsApp no card Status |

