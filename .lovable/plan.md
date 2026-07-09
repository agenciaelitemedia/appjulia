## Objetivo
Em `/wavoip`, permitir que o dono de um dispositivo Wavoip libere o acesso desse dispositivo a membros da sua equipe (compartilhamento por dispositivo), com um ícone de usuário em cada linha da lista.

## Modelo de dados (nova tabela)
Hoje `wavoip_devices` tem apenas `app_user_id` (um único dono). Para permitir múltiplos usuários por dispositivo sem quebrar nada, criar tabela de junção:

```text
wavoip_device_members
  id           uuid pk
  device_id    uuid  → wavoip_devices.id  (on delete cascade)
  app_user_id  bigint (users.id do app)
  granted_by   bigint
  created_at   timestamptz default now()
  unique(device_id, app_user_id)
```

- Enable RLS + GRANT `SELECT/INSERT/DELETE` para `authenticated`, `ALL` para `service_role`.
- Políticas: `SELECT` para usuários do mesmo `client_id` do dispositivo; `INSERT/DELETE` apenas para o dono (`wavoip_devices.app_user_id = current app user`).
- O dono continua sendo `wavoip_devices.app_user_id`. A tabela nova = "co-usuários" liberados.

## UI — `/wavoip` → aba "Meus dispositivos"
1. **Novo ícone `Users2`** (lucide) ao lado dos botões atuais em cada linha do dispositivo, com tooltip "Liberar acesso à equipe". Só aparece quando o usuário logado é o dono do dispositivo (`d.app_user_id === appUserId`).
2. Ao clicar, abrir um `Dialog` `ShareDeviceDialog`:
   - Lista de membros da equipe via `useTeamByClient()` (já existe).
   - Cada membro tem um `Switch` indicando se possui acesso; alternar chama insert/delete em `wavoip_device_members`.
   - Contador "X membros com acesso" no topo.
   - Não lista o próprio dono (já tem acesso).
3. Na linha do dispositivo, mostrar um mini-badge "+N" quando houver membros compartilhados, ao lado do nome, para dar visibilidade.

## Visibilidade dos dispositivos
Atualizar `WavoipPage` para que `myDevices` inclua:
- devices onde `app_user_id === appUserId` (dono), **ou**
- devices onde exista linha em `wavoip_device_members` com `app_user_id = appUserId`.

Para isso, fazer uma segunda query em `load()`: `select device_id from wavoip_device_members where app_user_id = appUserId` e mesclar. Os dispositivos compartilhados aparecem na mesma lista com um badge "Compartilhado por <nome do dono>" e sem o ícone de liberar acesso (apenas o dono libera). O usuário compartilhado pode Conectar/Discar normalmente.

## Arquivos a alterar/criar
- `supabase/migrations/<timestamp>_wavoip_device_members.sql` — nova tabela + RLS + GRANTs.
- `src/pages/wavoip/hooks/useWavoipDeviceMembers.ts` — hooks React Query: listar por device, adicionar, remover, e listar `device_ids` compartilhados com o usuário logado.
- `src/pages/wavoip/components/ShareDeviceDialog.tsx` — novo dialog com lista de membros + toggles.
- `src/pages/wavoip/WavoipPage.tsx` — botão `Users2` na linha, integração do dialog, merge de dispositivos compartilhados em `myDevices`, badge de contagem/origem.
- `src/integrations/supabase/types.ts` — regenerado automaticamente após a migration.

## Fora de escopo
- Herança automática do vínculo com fila/ramal — mantém-se como está.
- Não altera fluxo de conexão QR nem billing/plano (o compartilhamento é apenas de acesso operacional ao dispositivo já conectado).
