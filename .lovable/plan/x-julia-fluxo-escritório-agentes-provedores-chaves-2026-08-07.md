# X-Julia: fluxo Escritório → Agentes + provedores/chaves

## Objetivo
Trocar o fluxo atual (agente direto no escopo do usuário) por um fluxo em duas etapas:
Escritório (clientID) → N agentes X-Julia daquele escritório. E centralizar quais
provedores de LLM/voz existem (com chave padrão) em uma tela de Configuração do X-Julia,
deixando cada agente escolher entre a chave padrão ou uma chave própria do escritório.

## 1. Escritórios X-Julia (nova tela)
Nova rota `/x-julia/escritorios` (item de menu `x_julia_offices`, visível para admin;
usuário comum é redirecionado direto para os agentes do próprio escritório).

- Lista de escritórios que já possuem agentes X-Julia, cada linha com: nome/razão social,
  ClientID, quantidade de agentes, agentes ativos e badges dos provedores usados.
- Busca de escritório (mesmo comportamento do passo "Cliente" de `/admin/agentes-novo`:
  busca por nome/e-mail/CPF-CNPJ na base de clientes) para selecionar um escritório
  que ainda não tem agentes.
- Botão "Novo escritório" reaproveitando o cadastro de cliente existente
  (mesmos campos e validações do wizard de agentes: razão social, CPF/CNPJ com validação,
  e-mail, telefone, CEP com autocompletar endereço).
- Ao selecionar um escritório: define o escopo (`XJScopeContext`) e navega para
  `/x-julia/agentes`, que passa a mostrar apenas os agentes daquele ClientID com um
  cabeçalho "Escritório: X" e link para voltar à lista.
- Criação de agente só é permitida com escritório selecionado; o botão "Novo agente"
  fica desabilitado com aviso caso não haja escopo.

## 2. Configuração do X-Julia (nova tela)
Nova rota `/x-julia/configuracoes` (item de menu `x_julia_settings`, apenas admin):

- Lista de provedores de LLM (lovable, openai, openrouter, anthropic, deepseek, grok,
  gemini, llmapi) e de voz (elevenlabs, voicemaker). Para cada um:
  - switch "Ativo" (só provedores ativos aparecem para os agentes);
  - seleção de quais modelos/vozes ficam disponíveis;
  - campo de chave padrão (write-only, exibida apenas mascarada, nunca lida pelo front).
- Provedor "Lovable AI" não pede chave (usa a chave interna da plataforma).

## 3. Agente: LLM e Voz passam a respeitar a configuração
Na aba "LLM & Voz" do editor de agente:

- Os selects de provedor/modelo passam a listar apenas o que está ativo em
  Configuração do X-Julia (com aviso quando nada estiver ativo).
- Novo campo "Chave de API": **Padrão do sistema** ou **Personalizada do escritório**.
  Ao escolher personalizada, libera o campo para cadastrar a chave daquele ClientID
  (também write-only/mascarada). Mesmo controle para o provedor de voz.
- Se o agente estiver em "personalizada" e não houver chave cadastrada, o card mostra
  alerta e o agente não é considerado pronto para operar.

## 4. Backend (motor X-Julia)
- A resolução de chave passa a ser: se o agente usa chave personalizada, busca a chave
  do escritório; senão usa a chave padrão do provedor; Lovable AI continua usando a
  chave interna. Vale para LLM e para voz (TTS).
- Provedor inativo na configuração é rejeitado com erro claro no log da sessão.

## Detalhes técnicos
- Migração:
  - `xj_provider_settings` (provider, kind `llm|voice`, is_enabled, enabled_models jsonb,
    default_key text, timestamps) — RLS habilitado sem políticas de leitura; acesso só
    via edge function (service_role), igual ao padrão de `ai_provider_keys`.
  - `xj_client_provider_keys` (client_id, provider, kind, api_key, timestamps, unique
    (client_id, provider, kind)) — mesmo padrão write-only.
  - `xj_agents`: novas colunas `llm_key_mode` e `voice_key_mode` (`default|custom`,
    default `default`).
  - GRANTs: apenas `service_role` (front nunca lê essas tabelas), trigger de `updated_at`.
- Nova edge function `xj-provider-config`:
  - `GET` → provedores ativos, modelos liberados e status mascarado das chaves
    (global e, com `client_id`, a do escritório);
  - `POST` → grava switch/modelos/chave padrão (admin) ou chave do escritório.
- Frontend (tudo dentro de `src/modules/x-julia/`):
  - `pages/OfficesPage.tsx`, `pages/SettingsPage.tsx`;
  - `hooks/useXJOffices.ts` (contagem de agentes por client_id via `xj_agents`),
    `hooks/useXJProviderConfig.ts`;
  - `extend/clients.ts` ganha criação de cliente reaproveitando `externalDb`
    (mesmas regras do wizard de `/admin/agentes-novo`);
  - `AgentsPage.tsx` e `AgentEditorPage.tsx` ajustados conforme itens 1 e 3;
  - `module.ts` + `useEnsureXJuliaModule.ts` + `src/types/permissions.ts` +
    `src/App.tsx`: registrar os dois novos itens de menu/rotas.
- `supabase/functions/_shared/x-julia/llm.ts` e `tts.ts`: nova função de resolução de
  chave por agente/escritório.
