## Objetivo
Simplificar a lista de "Meus dispositivos" em `/wavoip`: um único ícone de editar (nome + filas vinculadas) e um badge no título mostrando quantos dispositivos do plano estão usados vs. disponíveis, com pluralização correta.

## Alterações em `src/pages/wavoip/WavoipPage.tsx`

### 1. Ícone único de editar
- Remover o botão com `ListTree` (vincular filas — linhas 607-618) e manter apenas o botão com `Pencil` (linhas 619-637), com tooltip "Editar dispositivo".
- Remover também o estado/dialog separado `queuesTarget` / `<DeviceQueuesDialog />` (não será mais necessário).
- Ampliar o diálogo de renomear para virar "Editar dispositivo", com dois campos, no mesmo layout do diálogo de adicionar:
  - `Nome do dispositivo *` (input já existente)
  - `Vincular às filas (opcional)` — mesma lista de checkboxes usada no diálogo de adicionar, populada por `useClientQueuesForLink(clientId)`.
- Ao abrir o diálogo, pré-preencher o nome com `d.device_name` e o conjunto de filas com `queuesByDevice[d.id]` (já derivado em memória).
- Ao salvar, executar em paralelo:
  1. Update do `device_name` na tabela `wavoip_devices` (fluxo já existente do rename) + invoke `wavoip-rename-device`.
  2. `setDeviceQueuesMut.mutateAsync({ deviceId, clientId, queueIds, createdBy: appUserId })` para sincronizar os vínculos.
- Fechar o diálogo apenas após ambas as promessas resolverem; manter tratamento de erro com `toast.error`.

### 2. Badge de contagem no título "Meus dispositivos"
- Calcular via `useMemo` a partir de `devices` (todos do client, já carregados):
  - `total` = `devices.length` (slots reservados pelo plano do client)
  - `used` = `devices.filter(d => d.app_user_id != null).length` (já foram reivindicados por algum usuário)
  - `available` = `total - used`
- Ao lado de `<CardTitle>Meus dispositivos</CardTitle>` (linha 483), renderizar um `<Badge variant="secondary">` com o texto:
  - `{used} {used === 1 ? 'usado' : 'usados'} / {available} {available === 1 ? 'disponível' : 'disponíveis'}`
- Envolver o título e o badge em um `div className="flex items-center gap-2"` para manter o alinhamento do header.

## Fora de escopo
- Nenhuma mudança em hooks (`useWavoipDeviceQueues`), edge functions, `DeviceQueuesDialog.tsx` (arquivo deixa de ser importado aqui; permanece no repo para não acoplar remoção de arquivo a esta mudança de UI), banco de dados ou fluxos de chamada.
