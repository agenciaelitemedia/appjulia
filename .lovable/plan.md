

# Configuração por Agente + Token visível

## Resumo
Reverter a aba Configuração do admin para gerenciar configs **por agente** (cada cod_agent tem seu próprio domínio/token/SIP). Adicionar toggle de visibilidade no campo Token.

## Mudanças

### 1. `ConfigTab.tsx` — listagem + formulário por agente
- Manter seção Webhook (URL para copiar, somente leitura)
- Substituir formulário único por:
  - **Tabela** listando todas as configs existentes (cod_agent, domínio, SIP, status, ações editar/excluir)
  - **Botão "Nova Configuração"** que abre formulário com: Cód. Agente, Domínio API, Domínio SIP, Token
- Token: adicionar botão Eye/EyeOff para alternar entre `type="password"` e `type="text"`
- Na tabela, token aparece mascarado com botão para revelar

### 2. `useTelefoniaAdmin.ts` — query e mutations de config
- `configQuery`: buscar **todas** as configs ativas (`phone_config` sem limit 1)
- `saveConfig`: manter como está (upsert por id)
- Adicionar `deleteConfig` mutation
- Retornar `configs` (array) em vez de `config` (singular)

### 3. Edge Function — sem mudança
A edge function já busca config por `cod_agent` primeiro e faz fallback para global. Funciona perfeitamente com múltiplas configs.

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/pages/admin/telefonia/components/ConfigTab.tsx` | Reescrever: tabela de configs + formulário por agente + toggle token |
| `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts` | Query retorna array, adicionar deleteConfig |

