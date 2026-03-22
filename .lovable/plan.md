

# Correções: Vinculação de ramal + Registro de chamadas pós-ligação

## Problemas identificados

1. **Ramal não vinculado**: O usuário "Ann Carolina" não tem nenhum registro em `phone_extensions` com `assigned_member_id` correspondente ao seu `user.id`. O sistema funciona corretamente ao mostrar "Indisponível" — o que falta é vincular/criar o ramal para ela.

2. **Chamadas não registradas após término**: Quando uma chamada SIP termina (`SessionState.Terminated`), o hook `useSipPhone` apenas reseta o estado local. Não há nenhuma chamada ao backend para registrar duração, gravação, custo etc. O webhook pode não estar recebendo eventos (depende da config na Api4Com). Precisamos de um fallback client-side.

## Alterações

### 1. `useSipPhone.ts` — callback `onCallEnded`
- Adicionar prop/callback `onCallEnded(info: { duration, callerInfo, startedAt, endedAt })` que dispara quando `SessionState.Terminated`
- Guardar `startedAt` internamente quando a chamada é estabelecida
- No terminated, calcular e chamar o callback com os dados da chamada

### 2. `api4com-proxy` — nova ação `get_call_details`
- Após hangup, buscar detalhes da chamada na Api4Com (ex: `GET /calls/{callId}` ou `/cdr`)
- Retornar: `record_url`, `duration_seconds`, `cost`, `hangup_cause`, `started_at`, `ended_at`

### 3. `api4com-proxy` — nova ação `complete_call_log`
- Recebe `call_id` ou `extensionNumber + phone + startedAt` para localizar o log
- Atualiza com: `ended_at`, `duration_seconds`, `hangup_cause`, `record_url`, `cost`, `status: 'hangup'`
- Se não encontrar log existente, cria um novo (fallback para quando webhook não criou)

### 4. `DiscadorTab.tsx` — registrar chamada ao terminar
- No `onCallEnded`, chamar `api4com-proxy` → `complete_call_log` com dados coletados
- Invalidar query `my-call-history` para atualizar histórico
- Mostrar toast com resumo (duração)

### 5. `PhoneCallDialog.tsx` — mesmo tratamento
- Registrar chamada ao terminar via mesmo fluxo

### 6. `useTelefoniaData.ts` — nova mutation `completeCallLog`
- Mutation que chama `complete_call_log` no proxy
- Reutilizável pelo Discador e pelo CRM

### 7. Webhook (`api4com-webhook`) — continua como está
- O webhook já trata channel-hangup e atualiza logs
- O `complete_call_log` faz upsert, então não duplica se o webhook já registrou

## Sobre o ramal da Ann Carolina
- O sistema está correto ao mostrar "Indisponível"
- A solução é: ir em Admin > Telefonia > Ramais, criar um novo ramal e vincular à Ann Carolina no seletor de membros
- OU sincronizar ramais existentes e editar o `assigned_member_id` para o ID dela

## Arquivos alterados
- `src/pages/telefonia/hooks/useSipPhone.ts` — callback onCallEnded + startedAt tracking
- `supabase/functions/api4com-proxy/index.ts` — ações `complete_call_log` e `get_call_details`
- `src/pages/telefonia/hooks/useTelefoniaData.ts` — mutation `completeCallLog`
- `src/pages/telefonia/components/DiscadorTab.tsx` — chamar completeCallLog no onCallEnded
- `src/pages/crm/components/PhoneCallDialog.tsx` — idem

