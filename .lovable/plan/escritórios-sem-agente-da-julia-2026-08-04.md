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

## Arquitetura: módulo independente

O módulo Escritórios vive em uma pasta autocontida `src/modules/escritorios/`, seguindo o mesmo padrão já usado pelo Flow Builder: **nada de fora é importado diretamente pelas telas do módulo**. Todo recurso vindo de outros módulos (banco, auth/permissões, planos, chat, filas, UI compartilhada) é exposto por arquivos `extend/*`, que são o único ponto de acoplamento com o resto do sistema. Se algo mudar fora, só os `extend/` são ajustados.

```text
src/modules/escritorios/
  module.ts                  # metadados, código do módulo, rotas
  routes.tsx                 # rotas do módulo (montadas no App)
  extend/
    db.ts                    # reexporta supabase + externalDb
    auth.ts                  # useAuth, isOwnerUser, usePermission
    permissions.ts           # leitura/gravação de permissões do usuário
    plans.ts                 # planos e limites
    chat.ts                  # ensureChatClientSettings e métricas de chat
    queues.ts                # filas do cliente
    ui.ts                    # componentes shadcn/reutilizáveis usados
  pages/                     # OfficesList, CreateOfficePage, EditOfficePage, OfficeDetailsPage, OfficeDashboardPage
  components/                # CreateOfficeWizard + steps (Cliente, Planos, Usuário, Módulos)
  hooks/                     # useOfficeSave, useOfficesList, useOfficeModules, useOfficeDashboard
  lib/                       # helpers próprios do módulo
```

- Os steps de Cliente/Planos/Usuário serão **implementados dentro do módulo** (cópia adaptada, sem abas de Configurações/Prompt e sem `cod_agent`), para que o módulo de agentes possa evoluir sem quebrar Escritórios.
- O dashboard de atendimentos também mora dentro do módulo (`pages/OfficeDashboardPage.tsx` + `hooks/useOfficeDashboard.ts`), consumindo dados via `extend/chat.ts` e `extend/queues.ts`.

## Detalhes técnicos

- Novos códigos de módulo `offices` e `dashboard_atendimento` em `src/types/permissions.ts`, com `extend/useEnsureOfficesModule.ts` dentro do módulo (padrão dos `useEnsure*Module`, via `externalDb.createModule`).
- `src/App.tsx` monta apenas o `routes.tsx` do módulo: `/admin/escritorios`, `/admin/escritorios-novo`, `/admin/escritorios/:id/editar`, `/admin/escritorios/:id/detalhes` (protegidas por `admin_agents`) e `/dashboard-atendimento` (protegida por `dashboard_atendimento`).
- Persistência via `extend/db.ts` → `externalDb` (`insertClient`, `insertUser`, plano/vencimento do cliente, permissões do usuário); serão adicionadas as actions que faltarem em `supabase/functions/db-query` (listar clientes sem agente, gravar o pacote de permissões).
- `useOfficeSave` reaproveita `generateSecurePassword` + bcrypt, `ensureChatClientSettings` (via `extend/chat.ts`) e log de criação, sem `insertAgent`/`insertUserAgent`.
- Dashboard de atendimentos consulta `chat_conversations`, `chat_messages`, `chat_analytics_daily` e `queues`, filtrado pelo `client_id` efetivo (`resolveEffectiveClientId`, exposto em `extend/auth.ts`).
- Redirecionamento pós-login: em `src/pages/Login.tsx`, escolher `/dashboard` ou `/dashboard-atendimento` conforme o usuário possuir agente vinculado.
- `MainLayout`/`AgentBlockedScreen`, `DisconnectedAgentsAlert` e `CopilotWidget` recebem guarda para clientes sem agente.
