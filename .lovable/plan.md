

## Usar alias do agente na tela de editar membros em /equipe

### Comportamento

Na lista de checkboxes de agentes do diálogo de criar/editar membro (`/equipe`), exibir o **alias** salvo (de `agent_aliases` por `cod_agent`) ao invés do `business_name`. Se não houver alias cadastrado, manter o comportamento atual usando `business_name` (com fallback via `getDefaultAlias` que já remove o prefixo `[JulIAv2]`).

Aplica-se aos dois grupos: "Meus Agentes" e "Agentes Monitorados".

### Implementação

**Arquivo editado**: `src/pages/equipe/components/AgentCheckboxList.tsx`

1. Importar o hook existente:
   ```ts
   import { useAgentAliases } from '@/hooks/useAgentAliases';
   ```

2. Dentro do componente:
   ```ts
   const { getAlias } = useAgentAliases();
   ```

3. Em `renderAgentItem`, substituir:
   ```tsx
   <span className="font-medium">{agent.business_name}</span>
   ```
   por:
   ```tsx
   <span className="font-medium">{getAlias(agent.cod_agent, agent.business_name)}</span>
   ```

O helper `getAlias(codAgent, fallbackBusinessName)` já implementa a lógica exata pedida: retorna o alias salvo se existir; caso contrário, retorna `getDefaultAlias(business_name)` (limpa `[JulIAv2]`).

### Resultado

Na tela `/equipe` → diálogo Novo/Editar Membro → seção "Agentes com Acesso", cada agente aparece pelo seu alias customizado (cadastrado em "Meus Agentes"), com fallback automático ao nome atual quando não há alias. O `#cod_agent` ao lado permanece como identificador técnico.

