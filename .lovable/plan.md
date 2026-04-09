

# Corrigir extração de foto e telefone do status UaZapi

## Problema

O endpoint `/instance/status` retorna dados aninhados em `instance` e `status`, mas o hook `useConnectedPhoneInfo` tenta ler do nível raiz. Por isso foto e telefone ficam `null`.

Estrutura real da resposta:
```text
data.instance.profilePicUrl  → foto
data.instance.owner          → telefone
data.instance.profileName    → nome
data.status.jid              → telefone alternativo
```

## Correção: `useConnectedPhoneInfo.ts`

Atualizar a interface e o mapeamento para extrair dos caminhos corretos:

```typescript
interface InstanceInfoResponse {
  // ... campos existentes no top-level ...
  instance?: {
    profileName?: string;
    name?: string;
    profilePicUrl?: string;
    owner?: string;
  };
  status?: {
    jid?: string;
  };
}
```

Mapeamento atualizado:
```typescript
return {
  phone: data?.phone || data?.instance?.owner || data?.status?.jid?.split(':')[0] || data?.wid || data?.owner || null,
  pushName: data?.pushName || data?.profileName || data?.instance?.profileName || data?.instance?.name || null,
  profilePictureUrl: data?.profilePicUrl || data?.profilePictureUrl || data?.instance?.profilePicUrl || null,
};
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/agente/meus-agentes/hooks/useConnectedPhoneInfo.ts` | Extrair dados dos caminhos aninhados `instance.*` e `status.*` |

