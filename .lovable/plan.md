

# Vincular membro da equipe ao criar ramal — com seletor estilo Equipe

## O que muda

### 1. `RamalDialog.tsx` — Seletor de membro da equipe
- Remover campo "ID do Membro (equipe)" (input numérico)
- Adicionar seletor dropdown/combobox com membros da equipe do cod_agent atual
- Incluir o próprio usuário logado como opção (primeira da lista, marcada como "Você")
- Mostrar nome + email de cada membro
- Ao selecionar, capturar `id`, `name` e `email` do membro
- Passar `email` e `label` (nome do membro) no `onSave`

### 2. `RamalDialog` — Props
- Receber `codAgent` como prop para buscar membros
- Buscar membros via `useTeamMembers()` ou query similar (membros vinculados ao agente)
- Buscar dados do usuário logado via `useAuth()` para incluir "a si próprio"

### 3. `useTelefoniaData.ts` — `createExtension`
- Receber `email` do membro selecionado
- Enviar `email` no body da chamada ao `api4com-proxy` → `create_extension`
- A senha gerada pela Api4Com (ou localmente) já é salva em `api4com_password` (já implementado)

### 4. `api4com-proxy` — `create_extension`
- Usar o `email` recebido do frontend no campo `email_address` do body para `/extensions/next-available`
- Usar `firstName` como nome do membro (em vez de "Ramal")

### 5. `MeusRamaisTab.tsx`
- Passar `codAgent` para o `RamalDialog`
- Na tabela, mostrar nome do membro em vez de ID numérico

### 6. Busca de membros da equipe
- Criar query local no RamalDialog usando `externalDb.getTeamMembers()` (mesmo padrão do EquipeMemberDialog)
- Incluir o user logado como primeira opção com badge "Você"

## Arquivos alterados
- `src/pages/telefonia/components/RamalDialog.tsx` — seletor de membro + email
- `src/pages/telefonia/components/MeusRamaisTab.tsx` — passar codAgent ao dialog
- `src/pages/telefonia/hooks/useTelefoniaData.ts` — enviar email na criação
- `supabase/functions/api4com-proxy/index.ts` — usar email recebido

