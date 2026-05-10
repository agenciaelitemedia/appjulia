## Causa raiz

O efeito de bootstrap em `src/contexts/WhatsAppDataContext.tsx` (linha 2318) recalcula uma `key` a partir de `clientId/currentQueueId/periodFilter/sortOrder/activeQueueIds`, mas só usa essa key para decidir se limpa a seleção. Todo o resto do efeito — **bump de epoch, reset de `convGroupMeta`, `setConversations([])` e o `runConvAutoLoad('active', Infinity)`** — roda **toda vez que `activeQueueIds` muda de referência**, mesmo com conteúdo idêntico.

`activeQueueIds` é um `useMemo` que depende da lista de filas, e essa lista é re-emitida com nova referência sempre que o realtime de filas dispara (e também por re-fetches periódicos). Resultado:

1. O loop `runConvAutoLoad` carrega a 1ª página (500 linhas) → `convGroupMeta.active.pages=1, hasMore=true`.
2. Antes de a 2ª página completar, `activeQueueIds` muda de referência (mesmo conteúdo).
3. Bootstrap re-executa: `convLoadEpochRef++` mata o loop em andamento, reseta meta para `pages=0, hasMore=true, isAutoLoading=false`, **zera `conversations`**, e dispara um novo loop do offset 0.
4. Isso se repete indefinidamente. O usuário vê "43 de 1688" travado porque cada ciclo só consegue completar 1 página antes do próximo reset.

Bug secundário: dentro de `runConvAutoLoad` (linha 622), o updater de `setConvGroupMeta` faz early-return se `isAutoLoading || autoLoadDone`, mas a função em si **não retorna** — o `while` segue rodando. Se duas chamadas escapam do guarda de bootstrap, ambas rodam em paralelo fazendo fetches duplicados.

## Correção

### 1. Gatear o bootstrap pela `key` (correção principal)

Em `WhatsAppDataContext.tsx`, dentro do efeito de bootstrap (linhas 2318–2359):

- Calcular `key` como hoje.
- **Se `prev === key`, retornar imediatamente** — não bumpar epoch, não resetar meta, não limpar `conversations`, não disparar `runConvAutoLoad`. Isso evita reinicializações espúrias quando `activeQueueIds` muda só de referência.
- Manter o reset / restart só quando `prev !== key` (mudança real de escopo) ou no primeiro run (`prev === null`).
- A lógica de wipe de seleção (linha 2353) já é correta — fica como está.

### 2. Tornar `runConvAutoLoad` reentrante-safe

Em `runConvAutoLoad` (linha 617):

- Antes do `setConvGroupMeta`, ler `convGroupMetaRef.current[group]` e fazer `if (meta.isAutoLoading || meta.autoLoadDone) return;` — encerra a função inteira, não só o updater.
- Mantém o `setConvGroupMeta` para marcar `isAutoLoading=true`.

### 3. Verificação

Após o patch, em `/chat`:
- Recarregar a página com filtro "Em Atendimento" ativo.
- Acompanhar `convGroupMeta.active.pages` crescendo monotonicamente até `hasMore=false`.
- Conferir no console que não aparece mais o ciclo "epoch++ → reset" repetido (pode adicionar um log temporário no bootstrap para confirmar que ele só roda 1× por mudança real de escopo).
- Footer deve evoluir de "500 de 1688" → "1000 de 1688" → … → "1688 de 1688".

## Arquivos afetados

- `src/contexts/WhatsAppDataContext.tsx` (somente — duas alterações pontuais).

Nenhuma mudança de banco, edge function ou UI.