

# Adicionar busca no seletor de agentes (estilo Select2)

## Problema
O seletor de agentes no `UnifiedFilters` abre um Popover com checkboxes, mas não tem campo de busca para filtrar agentes na lista. Com muitos agentes, fica difícil encontrar o desejado.

## Solução
Adicionar um campo de busca (input) no topo do Popover de agentes, filtrando a lista em tempo real conforme o usuário digita. A busca será feita pelo código do agente, nome e nome do escritório.

## Alteração

### `src/components/filters/UnifiedFilters.tsx`

1. Adicionar estado `agentSearch` para controlar o texto de busca
2. Adicionar `useMemo` para filtrar a lista de agentes pelo termo digitado (busca em `cod_agent`, `owner_name`, `owner_business_name`)
3. Inserir um `Input` com ícone de busca no header do Popover (acima do "Selecionar Todos"), com placeholder "Buscar agente..."
4. Renderizar `filteredAgents` em vez de `agents` na lista de checkboxes
5. Limpar o campo de busca ao fechar o Popover

A estrutura visual permanece a mesma (checkboxes com multi-seleção), apenas ganha o campo de busca no topo para filtrar rapidamente.

