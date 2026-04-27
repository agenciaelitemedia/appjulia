## Problema

O diálogo de transferência em `/chat` (`src/components/chat/TransferDialog.tsx`) usa hoje `useMyAgents()` num `<Select>` simples, listando **agentes de IA** ao invés de membros da equipe humana. A transferência de atendimento precisa apontar para uma pessoa do time (mesma base usada no resto do app — `TeamMemberSelect` + `useTeamByClient`).

## Solução

Substituir o `<Select>` de agentes pelo componente padronizado `TeamMemberSelect`, alimentado por `useTeamByClient()`, mantendo a mesma assinatura de `onTransfer(assignedTo, note?)` (passa o **nome** do membro, que é o formato já gravado em `chat_conversations.assigned_to` e usado pelo trigger `sync_conversation_to_deal`).

### Mudanças em `src/components/chat/TransferDialog.tsx`

1. Remover `useMyAgents` e o `<Select>`/`<SelectItem>` atuais.
2. Importar `TeamMemberSelect` (`@/components/TeamMemberSelect`) e `useTeamByClient` (`@/hooks/useTeamByClient`).
3. Mapear `data` do hook para `TeamMemberOption[]` (`{ id, name, email, role, photo }`).
4. Renderizar:
   ```tsx
   <TeamMemberSelect
     members={members}
     value={selectedMember}
     onValueChange={(v) => setSelectedMember(v)}
     valueKey="name"
     allowUnassigned={false}
     showCurrentUserShortcut
     placeholder="Selecione um membro da equipe…"
   />
   ```
5. Renomear estado `selectedAgent` → `selectedMember` para clareza.
6. Botão "Transferir" segue desabilitado até `selectedMember` ser preenchido; `onTransfer(selectedMember, note)` continua igual.
7. Manter o campo de nota opcional e o estado de loading.

### Não muda

- `ChatHeader.tsx` (continua chamando `assignConversation(conversationId, assignedTo)`).
- Triggers do banco (`sync_conversation_to_deal` já reage a `assigned_to`).
- Nenhuma alteração de schema.

## Resultado

A transferência em `/chat` passa a oferecer a equipe real do cliente (mesmo `client_id` resolvido via `vw_equipe`), com avatar, e-mail, badge de papel e atalho "Atribuir a mim" — consistente com os demais selects de responsável do sistema.