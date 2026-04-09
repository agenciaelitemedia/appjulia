

# Corrigir identificação de participantes — usar PhoneNumber em vez de JID/LID

## Problema

A API UaZapi usa o modo `AddressingMode: "lid"` (Linked ID). Os participantes retornam com JIDs do tipo `241476046987493@lid` em vez de `558881552198@s.whatsapp.net`. O número real do telefone está no campo `PhoneNumber` (ex: `"558881552198@s.whatsapp.net"`).

Dados reais da API:
```text
{
  "JID": "241476046987493@lid",
  "PhoneNumber": "558881552198@s.whatsapp.net",  ← número real aqui
  "LID": "241476046987493@lid",
  "IsAdmin": false,
  "DisplayName": ""
}
```

Problema adicional: em grupos com `IsIncognito: true` (comunidades), o campo `PhoneNumber` vem vazio e só existe `DisplayName` com formato mascarado (`"+55∙∙∙∙∙∙∙∙38"`). Nesses casos não é possível identificar colaboradores.

## Correção

No `normalizeGroup` dentro de `SupportGroupsTab.tsx`:

1. Extrair o telefone do campo `PhoneNumber` (removendo `@s.whatsapp.net`) como campo principal para identificação
2. Guardar o `PhoneNumber` no objeto do participante como campo `phoneNumber`
3. No `findTeamMember`, comparar usando `phoneNumber` em vez de `jid`
4. Exibir o telefone real na UI quando disponível, senão o `DisplayName`, senão o LID

```typescript
// Normalização do participante
const participants = (g.Participants || []).map((p: any) => {
  const phoneRaw = p.PhoneNumber || p.phoneNumber || "";
  const phone = phoneRaw.split("@")[0]; // "558881552198"
  return {
    jid: p.JID || p.jid || "",
    phoneNumber: phone,           // ← campo novo
    displayName: p.DisplayName || "",
    isAdmin: !!p.IsAdmin,
    isSuperAdmin: !!p.IsSuperAdmin,
  };
});

// Identificação de colaborador usa phoneNumber
const findTeamMember = (participant) => {
  if (!participant.phoneNumber) return undefined;
  return teamMembers.find(tm =>
    participant.phoneNumber.includes(tm.phone) || tm.phone.includes(participant.phoneNumber)
  );
};
```

Na UI, exibir: `member?.name || p.phoneNumber || p.displayName || p.jid`

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `SupportGroupsTab.tsx` | Extrair `PhoneNumber` dos participantes, usar para match de colaboradores e exibição |

