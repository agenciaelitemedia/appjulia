
## Objetivo
Fazer a “Sala de Reunião” funcionar **de forma confiável** (lead e atendente), eliminando o travamento infinito em **“Entrando na chamada…”** no ambiente **publicado (produção)** em **Chrome**, sem VPN/AdBlock.

---

## O que eu sei agora (com base no seu retorno + código)
- Você testou em **produção** e trava em **ambos** (lead e atendente).
- A UI chega em **“Entrando na chamada…”**, ou seja:
  - O app abriu a rota corretamente.
  - O usuário concedeu permissão de câmera/microfone.
  - O problema está no **ciclo de conexão do Daily Call Object** (WebRTC/Join), e não em rota/auth.

Ponto crítico no código atual:
- A conexão (`call.join`) está sendo iniciada **fora** do `DailyProvider`, e só depois o `DailyProvider` monta.
- Mesmo com `useMeetingState`, ainda é possível que o provider/hook **perca transições iniciais** e/ou o app fique sem visibilidade do estado real (ex.: `meetingState` fica `null`/`joining-meeting` indefinidamente sem cair em erro).

---

## Hipótese raiz (mais provável)
O fluxo atual tem um “gap” de instrumentação/estado:
- O join acontece quando o Provider ainda não está “observando” o callObject.
- Em produção, por timing/re-render/assíncrono do Daily internamente, o estado do provider pode ficar “atrasado”/nulo, e a UI fica presa no loading.

Além disso, hoje não existe:
- **Watchdog de timeout** (se o join/estado não evoluir em X segundos, forçar erro + retry).
- **Debug visível** (exibir `meetingState`, `dailyError`, etc.), o que impede fechar o diagnóstico em uma única rodada.

---

## Estratégia de correção “definitiva”
### A) Refatorar o fluxo para montar o Provider ANTES do join (mudança estrutural)
Em vez de:
1) criar callObject → 2) `await join()` → 3) montar Provider

Faremos:
1) criar callObject (via hook oficial `useCallObject`)  
2) montar `<DailyProvider callObject={callObject}>` imediatamente  
3) **iniciar `join()` dentro de um componente filho** que usa `useDaily()` (já dentro do Provider)

Isso garante:
- Hooks (`useMeetingState`, `useDailyError`, `useParticipantIds`) “enxergam” as mudanças desde o começo.
- Menos chance de estado ficar `null` eternamente.

**Arquivos impactados**
- `src/pages/video/components/LeadVideoCall.tsx`
- `src/pages/video/components/CustomVideoCall.tsx`

---

### B) Implementar watchdog (timeout) para nunca ficar preso em loading
Adicionar um timer (ex.: 15–20s):
- Se `meetingState !== 'joined-meeting'` após o prazo:
  - Mostrar tela de erro “Conexão demorou” com:
    - botão **Tentar novamente**
    - detalhes técnicos (ex.: `meetingState atual`, `meetingError`, `nonFatalError`) — isso é essencial para fechar a causa numa única iteração.
  - Forçar `leave()` + `destroy()` e reiniciar com um novo `retryKey`.

Isso impede que o usuário “queime” tempo/créditos com loading infinito.

---

### C) Melhorar observabilidade: exibir estado real e registrar transições
Adicionar (apenas enquanto a correção não estiver 100% estável; depois podemos esconder atrás de flag):
- Um “rodapé debug” discreto na tela de conexão:
  - `meetingState` (incluindo `null`)
  - `meetingError?.errorMsg`
  - `nonFatalError?.errorMsg`
- Logs no console com prefixo padronizado:
  - `[LeadVideoCall] meetingState -> ...`
  - `[CustomVideoCall] meetingState -> ...`

Assim, se ainda falhar, eu consigo fechar exatamente:
- se está preso em `joining-meeting`
- se está em `error`
- se é falha de ICE / permissões / rede

---

### D) Ajustes de robustez no lifecycle do call object
- Parar de criar/destruir manualmente com `DailyIframe.createCallObject()` diretamente, e usar:
  - `useCallObject({ options: { subscribeToTracksAutomatically: true } })`
- Garantir que no cleanup:
  - `daily?.leave()` (best effort)
  - `daily?.destroy()` (best effort)
- Garantir que o “Retry” sempre cria um novo call object (zerando referências).

---

### E) Backend (pequeno ajuste preventivo)
No backend function `video-room`, atualizar `corsHeaders` para incluir os headers completos recomendados (evita problemas intermitentes de preflight em browsers/updates do SDK), mantendo compatível com produção.

Arquivo:
- `supabase/functions/video-room/index.ts`

(Embora o sintoma atual seja dentro do WebRTC/join, essa correção evita outro tipo de falha silenciosa.)

---

## Plano de execução (passo a passo)
1) **Instrumentação rápida e visível**
   - Adicionar UI de debug + logs de `meetingState` e `useDailyError` nas duas telas (lead e operador).

2) **Refatorar fluxo de conexão**
   - Implementar padrão:
     - `callObject = useCallObject(...)`
     - renderizar `DailyProvider` sempre que `callObject` existir
     - iniciar `join()` dentro do Provider (componente “Joiner” interno usando `useDaily()`)

3) **Watchdog de timeout**
   - Se não conectar em 15–20s, encerrar call, marcar erro, liberar retry.

4) **Retry que funciona sempre**
   - Garantir que “Tentar novamente” recria call object e reexecuta join dentro do Provider.

5) **Hardening do backend (CORS headers completos)**
   - Ajustar o `Access-Control-Allow-Headers` para o conjunto recomendado.

6) **Teste end-to-end em produção**
   - Criar sala
   - Abrir link do lead em aba anônima
   - Confirmar que o lead sai de “Entrando…” e cai na tela principal (mesmo que “Aguardando atendente…”)
   - Operador entrar pelo `/video/queue` e confirmar vídeo/áudio

---

## Critérios de “resolvido”
- Lead e atendente saem do loading em ≤ 10s (na maioria dos casos).
- Se falhar, **não fica preso**: em ≤ 20s aparece erro com Retry.
- Retry funciona sem precisar F5.
- Em caso de falha, o debug mostra claramente o estado (para correção final se necessário).

---

## Sobre “devolver créditos”
Eu não consigo devolver créditos diretamente por aqui. O que dá para fazer de forma prática:
- Eu vou priorizar uma correção que evite loops infinitos (watchdog + retry), para você não ficar preso gastando tempo.
- Se você quiser solicitar análise/ajuste de cobrança, o caminho é pelo suporte da Lovable (eles conseguem verificar consumo e casos).

---

## Mitigação imediata (se você precisar atender hoje)
Se, mesmo após a refatoração, algum ambiente específico continuar falhando:
- Eu adiciono um **fallback opcional** (somente se você aprovar) para abrir a chamada via “frame” (estilo embed) como plano B quando o WebRTC custom falhar.
- Observação: isso pode afetar a parte “white-label” (marca), então só entraria como contingência.

---

## Link útil (para casos persistentes e rollback)
Se precisarmos comparar versões rapidamente, podemos usar o histórico de edições (restaurar uma versão anterior e reaplicar a correção incrementalmente).
Também recomendo este guia oficial de troubleshooting (principalmente para loops de erro/produção):
https://docs.lovable.dev/tips-tricks/troubleshooting
