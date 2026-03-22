

# Corrigir fluxo de exclusão de ramal (Api4Com + banco)

## Problemas atuais

1. **Não deleta o usuário organizacional**: O `create_extension` cria usuário via `POST /users` + ramal via `POST /extensions`, mas o `delete_extension` só deleta a extensão (`DELETE /extensions/{id}`). O usuário órfão permanece na Api4Com.

2. **Frontend deleta do banco mesmo se Api4Com falhar**: O `useTelefoniaData.ts` chama a Api4Com e depois deleta do banco, mas não verifica se a Api4Com retornou sucesso. Se falhar silenciosamente, o registro local é removido mas o ramal continua ativo no provedor.

3. **Sem `api4com_user_id` persistido**: O campo `api4com_raw` contém o `user_id` da criação, mas não há campo dedicado. O backend precisa extrair de `api4com_raw.user_id`.

## Correções

### 1. `api4com-proxy/index.ts` — action `delete_extension` completa
- Receber `extensionId` (api4com_id da extensão) e `codAgent`
- Buscar o registro no banco para obter `api4com_raw.user_id`
- **Passo 1**: `DELETE /extensions/{extensionId}` — remover ramal SIP
- **Passo 2**: `DELETE /users/{userId}` — remover usuário organizacional (se existir no `api4com_raw`)
- **Passo 3**: Deletar registro do banco `phone_extensions`
- Retornar resultado com status de cada operação
- Se falhar na Api4Com, retornar erro e **não** deletar do banco

### 2. `useTelefoniaData.ts` — simplificar delete
- Mover toda a lógica para o backend (proxy faz tudo: Api4Com + banco)
- Frontend apenas chama a action e trata sucesso/erro
- Remover o `delete` direto do Supabase no frontend

### Arquivos alterados
- `supabase/functions/api4com-proxy/index.ts` — reescrever case `delete_extension`
- `src/pages/telefonia/hooks/useTelefoniaData.ts` — simplificar mutation

