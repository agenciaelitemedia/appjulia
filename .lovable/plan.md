

# Configurar Domínio SIP do 3C+ (assessoria.3c.fluxoti.com)

## Problema

O domínio SIP correto para o 3C+ é `assessoria.3c.fluxoti.com`, mas o sistema usa o fallback hardcoded `pbx01.3c.fluxoti.com`. O campo `sip_domain` na tabela `phone_config` está NULL, e a interface administrativa não exibe esse campo quando o provedor é 3C+.

## Solução

### 1. Expor campo "Domínio SIP" na configuração 3C+ (`ConfigTab.tsx`)

Atualmente o campo "Domínio SIP (WebRTC)" só aparece no bloco Api4Com. Mover para fora do condicional de provedor ou duplicar no bloco 3C+, para que administradores possam definir o domínio SIP independente do provedor.

### 2. Atualizar fallback no proxy (`threecplus-proxy/index.ts`)

Linha 146: trocar o fallback de `pbx01.3c.fluxoti.com` para usar `config.sip_domain` com prioridade, mantendo fallback genérico só como último recurso.

```typescript
// Antes
const sipDomainFromRaw = config.sip_domain || 'pbx01.3c.fluxoti.com';

// Depois (sem mudança funcional — já está correto, só precisa popular o campo)
```

O código já respeita `config.sip_domain` quando preenchido. O problema real é que o campo nunca foi salvo.

### 3. Migração: popular o domínio para o agente atual

```sql
UPDATE phone_config 
SET sip_domain = 'assessoria.3c.fluxoti.com' 
WHERE cod_agent = '202601003' AND provider = '3cplus';
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `ConfigTab.tsx` | Mostrar campo Domínio SIP também para 3C+ |
| Migração SQL | Popular `sip_domain` do agente 202601003 |

