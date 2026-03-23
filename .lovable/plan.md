

# Bloquear telefonia no cliente quando agente está desativado

## Problema
Quando o admin desativa um agente de telefonia (`phone_user_plans.is_active = false`), o cliente continua podendo usar ramais e fazer ligações normalmente.

## Solução

### 1. `PhoneContext.tsx` — verificar `phone_user_plans.is_active` antes de ativar
- Após buscar a extensão do usuário (linha ~72), adicionar uma query ao `phone_user_plans` filtrando por `cod_agent` e `is_active = true`
- Se não encontrar plano ativo, **não** setar `myExtension` nem `codAgent`, impedindo SIP e discagem
- Resultado: `isAvailable = false`, badge mostra "Offline", softphone não conecta

### 2. `useTelefoniaData.ts` — planQuery já filtra `is_active = true`
- Já está correto (linha 17). Quando desativado, `plan = null` e `maxExtensions = 0`
- Porém precisamos garantir que `canCreateExtension` retorne `false` e que a UI mostre mensagem de plano desativado

### 3. `MeusRamaisTab.tsx` — exibir aviso quando plano desativado
- Se `plan === null` e não está carregando, mostrar um alerta informando que a telefonia está desativada para este agente
- Desabilitar botões de criar ramal e sincronizar

### 4. `DiscadorTab.tsx` — bloquear discagem
- Se `plan === null`, exibir mensagem de telefonia desativada e desabilitar o formulário de discagem

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/contexts/PhoneContext.tsx` | Checar `phone_user_plans.is_active` antes de ativar extensão/SIP |
| `src/pages/telefonia/components/MeusRamaisTab.tsx` | Alerta de telefonia desativada, desabilitar ações |
| `src/pages/telefonia/components/DiscadorTab.tsx` | Bloquear discagem se plano inativo |

