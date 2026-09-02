---
name: Integração Tramitação Inteligente (Planilha)
description: Plano aprovado para conectar a Julia à API Tramitação Inteligente — importar processos/movimentações/clientes, exportar leads como clientes/atividades, usar webhooks HMAC e exibir processos no CRM/chat.
type: feature
---
# Integração Julia ↔ Tramitação Inteligente (Planilha)

Data: 2026-09-02
Status: Aprovado para implementação
Local do plano: `docs/plano-integracao-tramitacao-inteligente.md`

## Resumo

Módulo isolado (`src/modules/tramitacao/`) que conecta a Julia à API REST da Tramitação Inteligente. A integração é por escritório, chave cifrada no servidor, com:

- Importação de processos, movimentações, clientes e publicações.
- Envio de leads do CRM Builder da Julia para a Tramitação como cliente + atividade.
- Sincronização em tempo real via webhooks assinados (HMAC).
- Importação agendada a cada 30 min (ligável).
- Bloco de processos dentro do card do CRM e do painel da conversa.

## Decisões de arquitetura

- **Módulo isolado** com `extend/` reexportando `supabase`, `externalDb`, `useAuth`, `resolveEffectiveClientId` (padrão dos módulos novos do projeto).
- **Tabelas prefixadas com `ti_`** no Supabase, com GRANT e RLS no padrão das demais tabelas do app.
- **Edge functions**: `ti-proxy` (gateway unificado), `ti-sync` (importação incremental), `ti-webhook` (recebe webhooks HMAC), `ti-export` (envia leads).
- **Chave por escritório**, cifrada com `src/lib/crypto.ts`, nunca exposta ao browser; resolvida pelo `client_id` no servidor.
- **Conflitos**: vence `updated_at` mais recente; CPF/CNPJ igual atualiza em vez de duplicar; exclusão remota só marca inativo.

## Banco de dados

- `ti_credentials` — chave cifrada, segredo do webhook, id do endpoint, status, timestamps.
- `ti_sync_config` — flags de importação, agendamento, etapa gatilho de exportação, CRM de origem.
- `ti_lawsuits`, `ti_lawsuit_movements`, `ti_customers` — espelho local, somente leitura, com `raw jsonb`.
- `ti_links` — ponte lead/contact local ↔ cliente/processo remoto.
- `ti_sync_logs` — direção, operação, contadores, erro, duração.

## Frontend

- Rota `/integracoes/tramitacao` com abas: Conexão, Importação, Envio, Vínculos e histórico.
- Hooks: `useTiCredentials`, `useTiSync`, `useTiLawsuits`, `useTiLinks`.
- Componente `LawsuitsPanel` reutilizado no card do CRM e no painel da conversa.
- `useEnsureTramitacaoModule` para auto-registro no menu e na matriz de permissões.
- Proteção por `ProtectedRoute` com módulo `integracao_tramitacao`; escrita limitada a proprietário/admin.

## Fases

1. Migração + `ti-proxy` + tela de Conexão com teste.
2. Importação de processos, movimentações e clientes + painel de processos no lead.
3. Webhooks HMAC + agendamento automático.
4. Envio Julia → Tramitação por gatilho de etapa, com log e vínculos.

## Validação

1. Salvar chave e obter "conectado" com contagem de clientes.
2. Importar e conferir processos, varas e movimentações.
3. Criar cliente na Tramitação e ver o espelho atualizar via webhook.
4. Mover lead para etapa gatilho e conferir cliente/atividade criados, sem duplicar.
5. Chave inválida mostra mensagem clara sem quebrar o resto do sistema.
