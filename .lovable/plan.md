

# Exibir dados do telefone conectado (UaZapi) nos cards de Meus Agentes

## Resumo

Quando o agente usa UaZapi e está conectado, buscar os dados do telefone via `/instance/info` e exibi-los no card: número do telefone, nome do perfil e foto de perfil.

## 1. Novo hook: `useConnectedPhoneInfo.ts`

Criar em `src/pages/agente/meus-agentes/hooks/useConnectedPhoneInfo.ts`:
- Recebe `hub`, `evoUrl`, `evoApikey`, `connectionStatus`
- Só executa query quando `hub === 'uazapi'` e `connectionStatus === 'connected'`
- Chama `client.get<InstanceInfo>('/instance/info')` via UaZapiClient
- Retorna `{ phone, pushName, profilePictureUrl }`

## 2. Alteração: `AgentCard.tsx`

- Importar e usar `useConnectedPhoneInfo`
- Abaixo da linha "Instância: ..." e quando `connectionStatus === 'connected'`, exibir:
  - Foto de perfil (Avatar pequeno, 24px)
  - Número do telefone conectado
  - Nome do perfil (pushName)
- Layout compacto com `text-xs`

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/agente/meus-agentes/hooks/useConnectedPhoneInfo.ts` | Novo hook |
| `src/pages/agente/meus-agentes/components/AgentCard.tsx` | Exibir dados do telefone conectado |

