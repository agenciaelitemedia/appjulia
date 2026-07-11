## Ajustes no `WavoipCallDialog` (chat)

Arquivo: `src/components/chat/WavoipCallDialog.tsx`

### Regras novas

1. **Fila com dispositivo vinculado e conectado** → pré-seleciona o dispositivo vinculado e **bloqueia** a troca (Select desabilitado), independentemente de haver outros conectados.
2. **Fila com dispositivo vinculado mas nenhum conectado** → mostra aviso e mantém Select desabilitado / botão Ligar inativo.
3. **Fila sem dispositivo vinculado** (ou conversa sem fila) → Select liberado com placeholder `Selecione um dispositivo...`, **sem** pré-seleção automática do primeiro conectado. Usuário precisa escolher manualmente.
4. **Botão Ligar** só fica ativo quando `deviceId` estiver preenchido E o dispositivo escolhido estiver conectado.

### Mudanças pontuais

- Remover o auto-select do primeiro conectado no `useEffect`. Só auto-selecionar quando `suggestedDeviceId` existir.
- Ao abrir o dialog sem sugestão: `setDeviceId('')` para forçar o placeholder.
- Ajustar `<Select disabled={...}>`:
  - `disabled = !!suggestedDeviceId` (quando há vínculo à fila, trava no vinculado).
  - Quando não há vínculo, `disabled = false` (mesmo com 1 só dispositivo, para permitir a escolha explícita).
- Placeholder do `SelectValue`: `Selecione um dispositivo...`.
- Mensagens acima do select:
  - Se `suggestedDeviceId`: manter "Sugerido pela fila desta conversa." (verde) — texto pode mudar para "Dispositivo definido pela fila desta conversa." para deixar claro que é obrigatório.
  - Se `queueId` tem vínculo mas nenhum conectado: mostrar aviso âmbar tipo "A fila desta conversa está vinculada a um dispositivo, mas ele não está conectado."
- Botão "Ligar" (`disabled`): `!deviceId || calling || !connected.some(d => d.id === deviceId)`.

### Fora de escopo

- Sem mudanças no `/wavoip`, hook `useWavoipDeviceQueues`, banco ou `WavoipCallButton`/`ChatHeader`.
- Sem alteração no comportamento de discagem em si.
