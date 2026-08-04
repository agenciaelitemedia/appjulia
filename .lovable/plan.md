# Escritórios sem Agente da Julia

Criar um novo módulo **Escritórios** que cadastra e lista clientes/usuários (escritórios) que usam a plataforma **sem** agente da Julia (sem `cod_agent`), liberando automaticamente o pacote de módulos operacionais (chat, painel CRM, ZAP Call, VoIP, equipe, mensagens rápidas, notificação interna, central de ajuda, automações, filas) e um novo dashboard de atendimentos.

## O que será entregue

1. **Módulo "Escritórios"** (auto-registro no menu, grupo ADMINISTRATIVO)
   - `Listar Escritórios` — tabela com nome/razão social, CPF/CNPJ, e-mail, usuário titular, plano, vencimento, status ativo, último acesso. Busca, ordenação, paginação, ativar/desativar e ações (ver, editar, permissões).
   - `Novo Escritório` — wizard cópia do de agentes, com as abas: **Cliente**, **Planos**, **Usuário** e nova aba **Módulos**. Sem abas de Configurações e Prompt, e sem geração de `cod_agent`.
   - `Editar Escritório` e `Detalhes do Escritório` — reaproveitando os componentes de cliente/usuário já existentes.

2. **Criação sem agente**
   - Cria/reutiliza o cliente, cria/reutiliza o usuário titular (senha temporária exibida como hoje), grava plano/limite/dia de vencimento no cliente, garante as configurações de chat do cliente e registra log de criação.
   - Nenhum registro em `agents` nem em `user_agents`; nenhum vínculo com agente da Julia.
   - Rollback igual ao fluxo de agentes se algum passo falhar.

3. **Liberação de módulos no cadastro**
   - Aba **Módulos** com o pacote pré-marcado e editável: Dashboard de Atendimentos, Chat, Painel CRM, ZAP Call, VoIP/Telefonia, Equipe, Mensagens Rápidas, Notificação Interna, Central de Ajuda, Automações (Flow Builder), Filas.
   - Ao salvar, o usuário titular fica com permissões customizadas apenas para os módulos marcados.

4. **Novo Dashboard de Atendimentos** (rota separada, ex. `/dashboard-atendimento`)
   - Métricas de chat/atendimento do cliente: conversas abertas / em atendimento / resolvidas no período, tempo de primeira resposta e de resolução, mensagens enviadas/recebidas, atendimentos por fila, por atendente e por canal, evolução diária e últimos atendimentos.
   - Filtro por período e por fila; sem nenhuma dependência de `cod_agent`.
   - Usuários de escritório passam a cair nessa rota após o login (o dashboard da Julia continua igual para quem tem agente).

5. **Ajustes para o sistema funcionar sem agente**
   - Garantir que a tela de bloqueio por agente inativo não afete quem não tem agente.
   - Revisar os pontos que hoje assumem existência de agente (chat, filas, automações, ZAP Call, copiloto, alertas de agente desconectado) para que fiquem ocultos/neutros quando o cliente não tem agente, sem alterar o comportamento de quem tem.

## Detalhes técnicos

- Novo diretório `src/pages/escritorios/` espelhando `src/pages/agents/`: `OfficesList.tsx`, `CreateOfficePage.tsx`, `EditOfficePage.tsx`, `OfficeDetailsPage.tsx`, `components/CreateOfficeWizard.tsx` (abas `ClientStep`, `PlanStep` reaproveitados + novo `ModulesStep`), `hooks/useOfficeSave.ts`, `useOfficesList.ts`.
- Novo código de módulo `offices` em `src/types/permissions.ts` + `useEnsureOfficesModule.ts` (padrão dos `useEnsure*Module`, via `externalDb.createModule`) e novo código `dashboard_atendimento` para o dashboard.
- Rotas em `src/App.tsx`: `/admin/escritorios`, `/admin/escritorios-novo`, `/admin/escritorios/:id/editar`, `/admin/escritorios/:id/detalhes` (protegidas por `admin_agents`) e `/dashboard-atendimento` (protegida por `dashboard_atendimento`).
- Persistência do escritório no Postgres externo via `externalDb` (`insertClient`, `insertUser`, atualização de plano/vencimento no cliente, `upsertUserPermissions`); serão adicionadas as actions que faltarem em `supabase/functions/db-query` (listagem de clientes sem agente, gravação do pacote de permissões).
- `useOfficeSave` reaproveita `generateSecurePassword` + bcrypt, `ensureChatClientSettings` e o log de mudanças, sem `insertAgent`/`insertUserAgent`.
- Dashboard de atendimentos em `src/pages/dashboard-atendimento/` consultando `chat_conversations`, `chat_messages`, `chat_analytics_daily` e `queues` no backend (Supabase), filtrado por `client_id` efetivo (`resolveEffectiveClientId`).
- Redirecionamento pós-login: em `src/pages/Login.tsx`, escolher `/dashboard` ou `/dashboard-atendimento` conforme o usuário possuir agente vinculado.
- `MainLayout`/`AgentBlockedScreen`, `DisconnectedAgentsAlert` e `CopilotWidget` recebem guarda para clientes sem agente.
