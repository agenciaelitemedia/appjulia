

# Corrigir domínio do email gerado na criação de ramal

## Problema
Na linha 181 do `api4com-proxy/index.ts`, o email fallback usa `@atendejulia.com` em vez de `@atendejulia.com.br`.

## Correção

### `supabase/functions/api4com-proxy/index.ts`
Alterar a linha 181:
```
// De:
const emailToUse = email || `ramal_${Date.now()}@atendejulia.com`;
// Para:
const emailToUse = `ramal_${Date.now()}@atendejulia.com.br`;
```
- Sempre gerar email aleatório `@atendejulia.com.br`, ignorando o email real do membro (a Api4Com precisa de email da organização, não do usuário real)

## Arquivo alterado
- `supabase/functions/api4com-proxy/index.ts` — linha 181

