

# Correção Definitiva: Habilitar Webphone 3C+ via Endpoint Correto

## Causa raiz identificada

Analisei a documentação oficial da 3C+ (api-docs.3c.fluxoti.com) em detalhe. A API possui um **endpoint dedicado** para habilitar o webphone:

```
PUT /users/{user-id}/enable/web_extension
```

O código atual usa `PUT /users/{user-id}` com `webphone: true` no body. O servidor aceita (200) mas **ignora** o campo `webphone` — ele não é um campo editável via PUT genérico. Por isso `webphone: false` persiste mesmo após "habilitar com sucesso".

Confirmação nos dados:
- `settings.web_extension: true` (já ativo — campo diferente)
- `webphone: false` (nunca mudou porque o endpoint errado foi usado)
- `POST /agent/webphone/login` retorna 403 porque `webphone` está false

## Plano

### 1. Corrigir `ensureWebphoneEnabled` no proxy

Substituir a chamada `PUT /users/{agentId}` com body `{webphone: true}` por:

```
PUT /users/{agentId}/enable/web_extension
```

Este é o endpoint correto documentado na API oficial. Não precisa de body complexo.

### 2. Limpar cache de credenciais SIP

Após habilitar o webphone com sucesso, limpar `threecplus_sip_domain`, `threecplus_sip_username`, `threecplus_sip_password` do ramal para forçar o sistema a chamar `/agent/webphone/login` e obter as credenciais SIP reais (incluindo o `sip_server` correto do PBX).

### 3. Fluxo esperado após a correção

```text
1. PUT /users/212546/enable/web_extension  → webphone = true
2. POST /agent/webphone/login (agent token) → 200 com sip_server, sip_user, sip_password
3. JsSIP conecta no sip_server real retornado pela 3C+
4. WebSocket funciona porque é o servidor PBX correto
```

## Detalhes técnicos

### Arquivo: `supabase/functions/threecplus-proxy/index.ts`

Função `ensureWebphoneEnabled`:
- Trocar `PUT /users/{agentId}` + body por `PUT /users/{agentId}/enable/web_extension`
- Verificar resposta e logar resultado
- Se bem-sucedido, limpar cache SIP do ramal no banco

### Migração SQL

Limpar credenciais SIP cacheadas do ramal 31 para forçar novo login:
```sql
UPDATE phone_extensions 
SET threecplus_sip_domain = NULL, 
    threecplus_sip_username = NULL, 
    threecplus_sip_password = NULL 
WHERE id = 31;
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Usar endpoint `/enable/web_extension` |
| Migração SQL | Limpar cache SIP do ramal 31 |

## Resultado esperado

- O webphone é efetivamente habilitado na 3C+
- O login retorna credenciais SIP reais com o servidor PBX correto
- O JsSIP conecta no domínio/porta certos
- O erro WebSocket 1006 desaparece

