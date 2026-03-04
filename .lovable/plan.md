

## Adicionar busca nas listas de agentes do MonitoramentoEditor

Alterar apenas `src/pages/admin/monitoramento/components/MonitoramentoEditor.tsx`:

1. Adicionar dois estados de busca: `searchLinked` e `searchAvailable`
2. Adicionar um campo `Input` com ícone de busca antes de cada `ScrollArea` (dentro de cada `TabsContent`)
3. Filtrar as listas `linkedAgents` e `availableAgents` por `client_name`, `business_name` ou `cod_agent` usando o termo de busca correspondente
4. Importar `Search` do lucide-react e `Input` do componente UI

O filtro será client-side, sem alterações no backend.

