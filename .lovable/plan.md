

# Adapter Completo UaZapi + Correção Listagem de Grupos

## Resumo

Dois objetivos:
1. Criar um adapter server-side completo para UaZapi (padrão hub) com todos os endpoints da documentação, seguindo o mesmo padrão do `WabaAdapter`
2. Corrigir a listagem de grupos no Assistente de Suporte para funcionar com a API real

## Diagnóstico do Problema de Grupos

A API UaZapi retorna campos em **PascalCase** (`JID`, `Name`, `Participants`, `IsAdmin`), mas o código atual normaliza usando camelCase (`id`, `subject`, `participants.id`). Além disso, tenta o endpoint inexistente `/group/fetchAllGroups`.

Resposta real do `GET /group/list`:
```text
{
  "groups": [
    {
      "JID": "120363153742561022@g.us",
      "Name": "Grupo Exemplo",
      "Participants": [
        { "JID": "5521987654321@s.whatsapp.net", "IsAdmin": true }
      ],
      "IsLocked": false,
      "IsAnnounce": false
    }
  ]
}
```

## Parte 1: Adapter Server-Side Completo (`uazapi-adapter.ts`)

Expandir o adapter existente em `supabase/functions/_shared/uazapi-adapter.ts` com todos os endpoints da documentação oficial, organizados por categoria:

**Grupos (prioridade):**
- `listGroups(force?, noParticipants?)` — `GET /group/list`
- `listGroupsPaginated(page, pageSize, search?)` — `POST /group/list`
- `getGroupInfo(groupjid, options?)` — `POST /group/info`
- `createGroup(name, participants)` — `POST /group/create`
- `leaveGroup(groupjid)` — `POST /group/leave`
- `updateGroupName(groupjid, name)` — `POST /group/updateName`
- `updateGroupDescription(groupjid, description)` — `POST /group/updateDescription`
- `updateGroupImage(groupjid, image)` — `POST /group/updateImage`
- `updateGroupAnnounce(groupjid, announce)` — `POST /group/updateAnnounce`
- `updateGroupLocked(groupjid, locked)` — `POST /group/updateLocked`
- `updateGroupParticipants(groupjid, action, participants)` — `POST /group/updateParticipants`
- `resetGroupInviteCode(groupjid)` — `POST /group/resetInviteCode`
- `joinGroup(invitecode)` — `POST /group/join`
- `getGroupInviteInfo(invitecode)` — `POST /group/inviteInfo`

**Comunidades:**
- `createCommunity(name)` — `POST /community/create`
- `editCommunityGroups(...)` — `POST /community/editgroups`

**Mensageria (já existente, manter + adicionar faltantes):**
- Manter: `sendText`, `sendMedia`, `sendLocation`, `sendContact`, `sendMenu`
- Adicionar: `sendCarousel`, `sendLocationButton`, `sendPixButton`, `sendRequestPayment`

**Chat (adicionar):**
- `findChats(filters)` — `POST /chat/find`
- `getChatDetails(number)` — `POST /chat/details`
- `editLead(data)` — `POST /chat/editLead`
- `archiveChat`, `blockChat`, `deleteChat`, `muteChat`, `pinChat`, `readChat`, `setLabels`

**Instance (expandir):**
- Manter: `getStatus`
- Adicionar: `getQRCode`, `reconnect`, `logout`

**Labels:**
- `listLabels`, `createLabel`, `updateLabel`, `deleteLabel`

Cada método normaliza os campos PascalCase da API para camelCase internamente.

## Parte 2: Atualizar Types Client-Side (`src/lib/uazapi/types.ts`)

Atualizar `GroupInfo` para mapear os campos reais:

```typescript
export interface GroupParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

export interface GroupInfo {
  jid: string;           // JID do grupo
  name: string;          // Name
  owner?: string;
  description?: string;
  size: number;
  participants: GroupParticipant[];
  isLocked?: boolean;
  isAnnounce?: boolean;
  isCommunity?: boolean;
  inviteLink?: string;
  pictureUrl?: string;
  creation?: number;
}
```

## Parte 3: Atualizar Endpoints Client-Side (`src/lib/uazapi/endpoints/group.ts`)

Atualizar para usar os nomes de campo corretos da API (`groupjid` em vez de `groupId`, `action` + `participants` no formato correto) e adicionar endpoints faltantes (join, inviteInfo, updateName, updateDescription, etc.).

## Parte 4: Corrigir `SupportGroupsTab.tsx`

Mudanças:
1. Usar `GET /group/list` como endpoint primário (é o correto na UaZapi)
2. Normalizar campos PascalCase: `JID` → `id`, `Name` → `subject`, `Participants[].JID` → `participants[].id`, `Participants[].IsAdmin` → `participants[].admin`
3. Remover tentativa de `/group/fetchAllGroups` (não existe na UaZapi)
4. Manter a divisão Colaboradores/Clientes usando `teamPhones`

## Parte 5: Atualizar Proxy Whitelist

Adicionar `/community/` ao `ALLOWED_PREFIXES` no proxy para suportar endpoints de comunidades.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/uazapi-adapter.ts` | Expandir com todos endpoints (grupos, chat, labels, etc.) |
| `supabase/functions/uazapi-proxy/index.ts` | Adicionar `/community/` ao whitelist |
| `src/lib/uazapi/types.ts` | Atualizar tipos de grupo para API real |
| `src/lib/uazapi/endpoints/group.ts` | Corrigir nomes de campo e adicionar endpoints |
| `src/pages/suporte-assistente/components/SupportGroupsTab.tsx` | Corrigir normalização PascalCase e endpoint |

