## Problema

A tabela `wavoip_device_members` foi criada sem `GRANT` explícito para os roles `anon`, `authenticated` e `service_role`. Confirmado via `information_schema.table_privileges`: nenhum privilégio existe.

Consequência no frontend (que usa o Supabase client com a chave anon):
- O `SELECT` retorna vazio (ou erro silencioso capturado pelo React Query) → os switches dos membros já liberados **não aparecem marcados** ao reabrir.
- Mesmo quando o insert/delete parece funcionar, o estado não persiste visualmente porque o read subsequente falha.

## Correção (1 migration)

Aplicar os GRANTs padrão de tabela de uso autenticado:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_device_members TO anon, authenticated;
GRANT ALL ON public.wavoip_device_members TO service_role;
```

Mantém a policy atual `USING (true) WITH CHECK (true)` (o controle de quem pode compartilhar é feito na UI — apenas o dono do dispositivo vê o botão "Liberar acesso").

Nenhuma alteração de código frontend é necessária — o hook `useWavoipDeviceMembers` e o `ShareDeviceDialog` estão corretos; só faltavam os privilégios de Data API.
