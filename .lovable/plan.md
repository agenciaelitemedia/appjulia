# Corrigir CRM de Notificações mostrando cards de outros escritórios

## Problema confirmado

A consulta dos cards do CRM de Notificações (`useAlertCrmCards`) filtra apenas por agente, período e busca — não filtra pelo escritório (client_id) do usuário logado. Como os cards já são gravados com o `client_id` do escritório, quando nenhum agente está selecionado (estado inicial da tela) a lista traz cards de todos os escritórios.

A aba Histórico do mesmo módulo já filtra por `client_id`, o que reforça que a omissão está só no CRM.

## Correção

- Passar a resolver o escritório efetivo do usuário logado (mesmo mecanismo já usado nos outros módulos: `resolveEffectiveClientId`, exposto via `extend/auth`) e aplicar `client_id` na consulta dos cards.
- Enquanto o escritório ainda não estiver resolvido, a consulta fica desabilitada (nada é exibido) em vez de listar tudo — evita o "flash" com dados de outros clientes.
- Garantia extra: quando nenhum agente está selecionado, restringir os cards aos códigos de agente que o usuário realmente vê no seletor de agentes da tela, cobrindo cards antigos que possam ter sido gravados sem `client_id`.
- Administradores globais continuam vendo tudo (mesma regra de dono/admin já usada no módulo), sem filtro por escritório.

## Detalhes técnicos

- `src/modules/notificacoes-alertas/extend/auth.ts`: reexportar `resolveEffectiveClientId`.
- `src/modules/notificacoes-alertas/hooks/useAlertCrmCards.ts`: adicionar `clientId` e `allowedAgentCodes` aos filtros; `.eq('client_id', clientId)` quando houver; `.in('cod_agent', allowedAgentCodes)` como rede de segurança quando `agentCodes` está vazio; incluir `clientId` na `queryKey` e usar `enabled`.
- Novo hook `hooks/useAlertsClientId.ts` (padrão de `useDspClientId`/`useOfficeClientId`) para resolver o `client_id` efetivo.
- `src/modules/notificacoes-alertas/components/CrmNotificacoesTab.tsx`: passar `clientId` e a lista de `cod_agent` de `useCRMAgents` para o hook; manter loading enquanto o escritório resolve.
- Nenhuma mudança de banco, de edge function ou de layout.
