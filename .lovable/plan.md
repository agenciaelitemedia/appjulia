## Análise minuciosa: detecção de Online/Offline

A funcionalidade combina **3 fontes** para decidir se um usuário está online no `/equipe`:

```text
                  ┌──────────────────────────────┐
 aba ativa  ───►  │ 1. Presence (websocket)      │ → onlineIds
                  │    presenceChannel.ts        │
                  └──────────────────────────────┘
                  ┌──────────────────────────────┐
 aba ativa  ───►  │ 2. Heartbeat DB (30s)        │ → user_presence.last_seen_at
                  │    useHeartbeat.ts           │   (fresh se < 75s)
                  └──────────────────────────────┘
                  ┌──────────────────────────────┐
 login/logout ─►  │ 3. user_activity_log         │ → último login/logout
                  │    logUserActivity()         │   (apenas exibido na coluna)
                  └──────────────────────────────┘

EquipeDashboardTab: isOnline(id) = onlineIds.has(id) || isFresh(id)   ← OR
```

### Falsos positivos identificados (ranking por risco)

**1. Presence sozinho mantém usuário "online" depois de fechar a aba** — RISCO ALTO
Em `EquipeDashboardTab` o cálculo é `OR`. Se o navegador fecha sem disparar `leave` (mobile, kill, perda de rede súbita), o presence_state pode permanecer alguns minutos. Como `OR`, basta o presence ainda listar o `user_id` para mostrar Online, mesmo com `last_seen_at` vencido há minutos. O heartbeat foi desenhado justamente para corrigir isso, mas o `OR` anula o ganho.

**2. RLS aberta em `user_presence` permite forjar presença de outros** — RISCO ALTO (segurança + falso positivo)
A política atual é `user_presence_all` com `using=true`/`check=true`. Qualquer cliente autenticado pode `UPSERT` qualquer `user_id`/`client_id`, "marcando" colegas como online. Também não há validação de que `user_id` no payload bate com a sessão.

**3. Logout não zera `user_presence`** — RISCO MÉDIO
`logout()` em `AuthContext` não apaga a linha em `user_presence`. Resultado: por até 75 s após sair, o usuário aparece Online. Idem para logout por inatividade (1 h).

**4. Fechamento de aba não notifica nada** — RISCO MÉDIO
Não há handler em `pagehide`/`beforeunload` enviando `sendBeacon` para apagar/expirar a linha. A única "expiração" é o decaimento de 75 s.

**5. Heartbeat pausa em `visibilityState === 'hidden'`** — RISCO BAIXO/AMBÍGUO
Aba minimizada/em background fica offline em ~75 s mesmo com o usuário logado. Pode ser intencional ("Online = vendo agora"), mas o card "Online x/y" no topo passa a refletir _abas em foco_, não _usuários logados_. Precisa ser uma decisão explícita.

**6. "Online" não considera atividade do mouse/teclado** — RISCO MÉDIO
Aba aberta em foco com usuário ausente continua pingando (timer + visibilitychange). Isso causa o falso positivo conceitual mais comum no dia-a-dia: pessoa saiu para almoçar, segue Online por até 1 h até o auto-logout disparar. O `AUTH_LAST_ACTIVITY` (mouse/teclado) já existe no `AuthContext`, mas não é usado pelo heartbeat.

**7. Comparação `Date.now()` vs `last_seen_at` (clock skew)** — RISCO BAIXO
`isFresh` compara horário do servidor (vindo do `now()` do upsert) com `Date.now()` do cliente. Se o relógio do cliente que está _olhando_ o painel estiver adiantado/atrasado, o status pisca. Pequeno, mas elimina-se computando server-side.

**8. `onConflict: 'user_id'` ignora `client_id`** — RISCO BAIXO
Funciona porque `user_id` é PK, mas se um usuário pertencer a mais de um client_id em momentos distintos, a coluna `client_id` da última escrita "vence" e o filtro `client_id=eq.X` no Realtime pode atrasar invalidações.

**9. `useMemo(sorted, [..., presence])` não reordena no tick** — RISCO BAIXO
O `setNow` força re-render, mas `sorted` só recalcula quando `presence` muda de identidade. Quem passou de online → offline pelo decaimento de 75 s não é reordenado até a próxima invalidação realtime.

**10. Múltiplas abas e sincronização** — RISCO BAIXO
Cada aba sobe seu próprio heartbeat e canal de presence. Se o usuário fizer logout em uma aba, as outras continuam pingando até detectarem (`storage` event → set user null → cleanup do effect). Janela curta, mas existe.

---

## Plano de correção (sem expandir escopo)

### A. Banco e segurança (migração)

1. Trocar a política única `user_presence_all` por:
   - `select`: linhas do mesmo `client_id` do solicitante (mantém visibilidade da equipe).
   - `insert`/`update`/`delete`: somente da própria linha do usuário, validando `user_id` contra um claim controlado (como o app usa auth custom sem `auth.uid()`, encapsular via função `set_my_presence(p_user_id, p_client_id)` `SECURITY DEFINER` com checagem em `user_activity_log` + assinatura curta no token, OU bloquear escrita direta e expor apenas a função). **Decisão a confirmar com o usuário** — ver pergunta abaixo.
2. Adicionar função `public.touch_user_presence(p_user_id bigint, p_client_id bigint)` que faz upsert e devolve `now()` do servidor; o cliente passa a usar esta função no lugar do `from('user_presence').upsert(...)`.
3. Adicionar função `public.clear_user_presence(p_user_id bigint)` para o logout (e para o beacon de fechamento) — apaga a linha.
4. Criar view `public.user_presence_status` calculando `is_online` server-side: `last_seen_at > now() - interval '75 seconds'`. Frontend lê dela e elimina o problema de clock skew.

### B. Frontend

1. **`useHeartbeat`**: trocar upsert direto por `rpc('touch_user_presence', ...)`. Adicionar handler `pagehide` (e `beforeunload` como fallback) usando `navigator.sendBeacon` para `clear_user_presence`. Ao desmontar (logout/troca de rota fora do `MainLayout`), também chamar `clear_user_presence`.
2. **`AuthContext.logout()` e ramo de logout-por-inatividade**: chamar `clear_user_presence` antes de limpar `localStorage`.
3. **`EquipeDashboardTab.isOnline`**:
   - Mudar de `onlineIds.has(id) || isFresh(id)` para **`isFresh(id)`** como verdade primária (heartbeat = fonte autoritativa server-side).
   - Manter `onlineIds` apenas como _hint_ de "ativo agora" (badge "Vendo" opcional), não para flipar Online/Offline.
4. **Sincronizar com atividade do usuário**: expor `AUTH_LAST_ACTIVITY` via um pequeno hook e exigir `now - lastActivity < 5 min` para considerar "Online ativo"; entre 5 min e o auto-logout, mostrar **"Ausente"** (badge âmbar) em vez de Online. Elimina o falso positivo do almoço.
5. **`useTeamHeartbeat`**: ler da view `user_presence_status` (já traz `is_online` calculado pelo servidor) e dispensar o tick local de 30 s para flipar status — manter o tick só para envelhecer o rótulo "ativo há X".
6. **`useMemo(sorted)`**: incluir um contador derivado do tick nos deps, ou recomputar ordenação quando algum `isFresh(id)` muda.

### C. Decisões de produto (precisam de confirmação)

- O que significa "Online"?
  (a) **Aba aberta + foco** (comportamento atual, falso positivo de "ausente").
  (b) **Aba aberta + interação recente (≤5 min)** — recomendo, espelha WhatsApp.
  (c) **Apenas logado** (mostra Online enquanto a sessão durar, mesmo aba minimizada).
- Mostrar estado intermediário **"Ausente"** entre Online e Offline?

### D. Itens fora do escopo desta correção

- Logs `user_activity_log` (login/logout) já estão corretos e seguem auditáveis.
- Card de totais "Online x/y" passa a refletir a nova definição automaticamente — sem mudança no componente além do `isOnline`.

---

## Perguntas antes de implementar

1. Qual definição de "Online" adotar? (a) aba em foco, (b) aba + interação ≤5 min (recomendado), (c) só sessão ativa.
2. Quer o estado intermediário **"Ausente"** com cor âmbar?
3. Posso reescrever a RLS de `user_presence` para `select` por `client_id` e bloquear `insert/update/delete` direto, expondo apenas funções `touch_user_presence` / `clear_user_presence`? (corrige o risco de forjar presença alheia)
