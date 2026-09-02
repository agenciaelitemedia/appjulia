# Plano: Integração Julia ↔ Tramitação Inteligente (Planilha)

Data: 2026-09-02
Status: Aprovado para implementação

## Visão geral

Nova integração entre a Julia e a plataforma **Tramitação Inteligente** (Planilha). A API externa é REST, autenticada por Bearer token, com 69 operações em 13 grupos e webhooks assinados por HMAC. A integração é por escritório, com chave cifrada no servidor, e cobre:

- Importar **processos**, **movimentações**, **clientes** e **publicações**.
- Enviar leads da Julia para a Tramitação como **clientes** e **atividades**.
- Sincronização via webhooks em tempo real e importação agendada.
- Exibir os processos do cliente dentro do card do CRM e do painel da conversa.

## Requisitos verificados

- Chave de API válida para o escritório fornecido.
- Formato confirmado: `lawsuits[]` com `number`, `court`, `status`, `valor_da_causa_in_cents`, `customers[]`, `tags[]` e paginação `{count, page, pages, next}`; `customers[]` com `cpf_cnpj`, `phone_mobile`, `tags[]`.
- 369 processos na conta de teste.
- Webhooks assinados com `X-Webhook-Signature` e eventos de cliente, atividade, publicação e e-mail recebido.

## Experiência do usuário

- Tela em **Integrações › Tramitação Inteligente** (`/integracoes/tramitacao`), com abas:
  1. Conexão (chave + teste + status).
  2. Importação (o que trazer + sincronizar agora + agendamento).
  3. Envio (etapa gatilho do CRM + criar cliente/atividade na Tramitação).
  4. Vínculos e histórico (lead ↔ cliente/processo + log das sincronizações).
- Bloco **Processos** no card do CRM e no painel da conversa, com número, vara, status e movimentações recentes.
- Conflitos: vence o registro mais recente (`updated_at`); CPF/CNPJ igual atualiza em vez de duplicar; exclusão remota só marca inativo, nunca apaga.

## Banco de dados (tabelas `ti_*`)

- `ti_credentials` — chave cifrada, segredo do webhook, id do endpoint, status, timestamps.
- `ti_sync_config` — flags de importação, agendamento, etapa gatilho de exportação, CRM de origem.
- `ti_lawsuits`, `ti_lawsuit_movements`, `ti_customers` — espelho local, somente leitura, com payload bruto em `jsonb`.
- `ti_links` — ponte entre lead/contact local e cliente/processo remoto.
- `ti_sync_logs` — direção, operação, contadores, erro, duração.
- Índices por `client_id`, `updated_at`, `cpf_cnpj` e `number` normalizados.
- Toda tabela segue o padrão de GRANT e RLS do projeto.

## Edge Functions

- `ti-proxy` — gateway único no padrão `{action, data}`. Ações: `test`, `list_lawsuits`, `get_lawsuit`, `list_movements`, `list_customers`, `upsert_customer`, `create_activity`, `list_publications`, `register_webhook`. Resolve a chave pelo `client_id`, nunca a aceita do cliente; aplica retry/backoff em 429/5xx; não devolve a chave ao browser.
- `ti-sync` — importação paginada e incremental; guarda o maior `updated_at` por recurso; grava no espelho e em `ti_sync_logs`; pode ser chamado manualmente ou por `pg_cron`.
- `ti-webhook` (`verify_jwt = false`) — recebe webhooks, valida HMAC, deduplica, aplica patch no espelho e dispara Realtime. Registra o endpoint automaticamente quando a chave é salva.
- `ti-export` — chamado pelo gatilho de etapa do CRM: procura cliente por CPF/CNPJ, cria/atualiza na Tramitação e, se configurado, cria atividade; grava vínculo em `ti_links`.

## Frontend

- Módulo isolado em `src/modules/tramitacao/`:
  - `extend/` reexportando `supabase`, `externalDb`, `useAuth`, `resolveEffectiveClientId`.
  - `pages/TramitacaoPage.tsx` com as 4 abas.
  - `hooks/useTiCredentials.ts`, `useTiSync.ts`, `useTiLawsuits.ts`, `useTiLinks.ts`.
  - `components/LawsuitsPanel.tsx` reutilizado no CRM e no chat.
  - `hooks/useEnsureTramitacaoModule.ts` para auto-registro do módulo no menu/permissões.
- Proteção por `ProtectedRoute` com o módulo `integracao_tramitacao`; escrita limitada a proprietário/admin via `isOwner`/`hasPermission`.

## Segurança

- Chave cifrada com `src/lib/crypto.ts` e usada apenas no servidor.
- Front nunca chama o domínio externo diretamente.
- Todo espelho filtra por `client_id` efetivo.

## Fases de implementação

1. Migração + `ti-proxy` + tela de Conexão com teste (valor imediato: chave validada).
2. Importação de processos, movimentações e clientes + painel de processos no lead.
3. Webhooks assinados (tempo real) + agendamento automático.
4. Envio Julia → Tramitação (cliente + atividade) por gatilho de etapa, com log e vínculos.

## Critérios de aceitação

1. Salvar a chave e obter "conectado" com a contagem correta de clientes.
2. Importar e conferir os 369 processos com números, varas e movimentações batendo com a origem.
3. Criar um cliente na Tramitação e ver o espelho atualizar sem nova importação manual (webhook).
4. Mover um lead para a etapa gatilho e conferir o cliente/atividade criados lá, sem duplicar quando repetido.
5. Chave inválida → mensagem clara na tela, sem quebrar as outras áreas do sistema.
