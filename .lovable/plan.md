## Problema

Os registros de `wavoip_device_members` existem no banco (confirmado: 3 membros já liberados no dispositivo `f2e45f35...`), mas o frontend não consegue lê-los. A tabela **não tem GRANTs** para os roles `anon` e `authenticated` da Data API:

```
grantee      | privilege_type
sandbox_exec | INSERT
sandbox_exec | SELECT
```

Consequência: o `SELECT` do hook `useWavoipDeviceMembers` retorna vazio (bloqueado por permissão antes do RLS ser avaliado), então os switches nunca aparecem marcados ao reabrir o diálogo. A migração anterior que tentava corrigir isso não foi efetivada.

## Correção (1 migração)

Aplicar os GRANTs de Data API na tabela:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_device_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_device_members TO anon;
GRANT ALL ON public.wavoip_device_members TO service_role;
```

Justificativa do `anon`: o app usa a chave anon do Supabase client para todas as chamadas (o `AuthContext` é externo, não usa `auth.uid()`), e a policy atual é `USING (true) WITH CHECK (true)` — o controle de quem pode liberar acesso é feito na UI (botão "Liberar" só aparece para o dono do dispositivo).

## Validação após aplicar

Verificar via `information_schema.table_privileges` que os 4 roles aparecem, então reabrir o diálogo "Liberar acesso" no dispositivo — os 3 switches (usuários 191, 227, 209) devem aparecer marcados.

## Sem mudanças de frontend

O hook `useWavoipDeviceMembers`, o `ShareDeviceDialog` e o `useToggleWavoipDeviceMember` já estão corretos. Apenas faltam os privilégios de Data API.
