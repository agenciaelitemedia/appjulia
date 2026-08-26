# Aba "Público" no módulo de Disparos

Nova aba em `/disparos` para criar e manter **grupos de contatos (públicos)** reutilizáveis nas campanhas, com três formas de montagem: importação de CSV, cadastro manual e busca por filtros dentro dos dados da Julia (chat, CRM Julia, CRM Builder, contratos, follow-up, campanhas).

## Como o usuário vai usar

1. Aba **Público** lista os públicos do escritório com: nome, origem (CSV / Manual / Filtro), total ativo, total removido, campanhas que já usaram, status (ativo/arquivado) e data da última atualização.
2. Botão **Novo público** abre um wizard de 4 passos:
   - **Passo 1 — Identificação:** nome, descrição, e escolha da origem.
   - **Passo 2 — Coleta**, conforme a origem:
     - **CSV:** upload, leitura do cabeçalho e tela de **mapeamento de colunas** (Nome completo, Primeiro nome, WhatsApp, E-mail, Documento/CPF, Cidade/UF, Etiqueta livre, além de até 5 campos extras salvos como variáveis para uso nos templates). O primeiro nome é derivado automaticamente do nome completo quando a coluna não é mapeada.
     - **Manual:** formulário 1 a 1 (nome + WhatsApp + campos opcionais), com lista acumulada editável.
     - **Filtro:** painel de filtros combináveis (detalhados abaixo) com botão **Validar** que mostra o total encontrado em tempo real.
   - **Passo 3 — Revisão:** tabela paginada com nome, primeiro nome e WhatsApp já normalizado (+55 DDD 9XXXXXXXX), separando em abas: **Válidos**, **Inválidos** (com o motivo: número curto, DDD inexistente, fixo, duplicado, na supressão) e **Duplicados**. Só os válidos entram no público.
   - **Passo 4 — Confirmação:** resumo dos totais e gravação.
3. Ao abrir um público existente: ver/pesquisar contatos, adicionar manualmente, importar mais um CSV (mesmo fluxo de mapeamento), remover contatos individualmente e — quando a origem for filtro — botão **Atualizar pelo filtro**, que roda o filtro salvo de novo e mostra um diff antes de aplicar:
   - `X novos serão adicionados`
   - `Y deixaram de atender ao filtro e serão marcados como removidos`
   - nada é apagado: contatos fora do filtro ficam com status `removed` e podem ser restaurados.
4. **Exclusão:** bloqueada se o público já foi usado em qualquer campanha — nesse caso só **Arquivar** (deixa de aparecer na seleção de campanha, mas o histórico continua íntegro). Públicos nunca usados podem ser excluídos com dupla confirmação.
5. **Campanhas:** no passo de audiência do wizard, um seletor `Origem do público`:
   - **Lista avulsa** (comportamento atual: telefones colados + filtros rápidos), ou
   - **Público existente** (combo só com públicos ativos, mostrando o total). A preparação da campanha passa a ler os contatos do público em vez de reconstruir filtros.

## Validação de WhatsApp

Reaproveita `normalizeBrPhone` / `brPhoneVariants` (frontend) e `toE164Br` / `isValidBrPhone` (`_shared/dsp-core.ts`) — mesma regra já usada pelos disparos, garantindo consistência. Regras aplicadas na importação:
- somente dígitos, DDI 55 assumido quando ausente;
- DDD válido (lista Anatel), 9º dígito aplicado quando for celular;
- fixos e números fora do padrão vão para a aba **Inválidos** (o usuário decide se corrige e reimporta);
- deduplicação pelo E.164 canônico dentro do arquivo e contra o que já existe no público;
- cruzamento com `dsp_suppression` para marcar quem está em opt-out.

## Filtros disponíveis na origem "Filtro"

Todos combináveis (AND entre grupos, OR dentro do grupo) e todos escopados ao `client_id`:

- **Chat / contatos:** filas (`queues`), canal (uazapi / API oficial / Instagram / webchat), tags de conversa, status da conversa, responsável/atendente, período da última mensagem, "só quem tem conversa", "sem resposta há X dias".
- **Agentes de IA:** `cod_agent` (um ou vários).
- **CRM Julia (leads):** etapas do funil clássico, período de entrada na etapa.
- **CRM Builder:** painel (board), pipeline e etapas específicas.
- **Contratos:** em curso (não assinado) / assinados, com faixa de data.
- **Follow-up:** em follow-up ativo há X tempo / etapa do follow-up.
- **Campanhas de disparo:** já participou / não participou da campanha Z; respondeu / não respondeu.
- **Exclusões:** remover quem está na supressão, remover quem já está em outro público (opcional).

A validação (contagem) e a resolução final rodam no backend, garantindo o mesmo resultado na prévia e na materialização.

## Detalhes técnicos

**Banco (migração nova):**
- `dsp_audiences`: `client_id`, `name`, `description`, `source` (`csv|manual|filter|mixed`), `filters jsonb`, `status` (`active|archived`), `field_map jsonb`, `total_active`, `total_removed`, `last_synced_at`, `created_by`, timestamps. Índice único por (`client_id`, `name`) para nomes ativos.
- `dsp_audience_contacts`: `audience_id`, `client_id`, `phone_e164`, `name`, `first_name`, `email`, `document`, `extra jsonb`, `contact_id` (FK lógica para `chat_contacts.id` quando o número já existir), `origin` (`csv|manual|filter`), `status` (`active|removed`), `invalid_reason`, timestamps. Único por (`audience_id`, `phone_e164`).
- `dsp_campaigns.audience_id uuid null` + `audience_mode text default 'inline'`.
- GRANTs (`authenticated` CRUD, `service_role` ALL) e RLS seguindo o padrão já usado nas tabelas `dsp_*` do módulo.

**Edge function nova `dsp-audience` (actions em um único `switch`):**
- `resolve_preview` → aplica os filtros e retorna `{ total, sample[] }` (amostra de 200) sem gravar.
- `materialize` → grava os contatos resolvidos no público.
- `refresh` → recalcula, retorna o diff (`to_add`, `to_remove`) e, com `apply: true`, insere os novos e marca os ausentes como `removed`.
- `link_contacts` → resolve `contact_id` via `chat_contacts` usando `brPhoneVariants`.
Filtros que dependem do Postgres legado (CRM Julia clássico, contratos, follow-up, `cod_agent`) são consultados através da função `db-query` existente, no mesmo padrão dos outros módulos; os filtros de chat/CRM Builder vão direto no Supabase.

**Frontend (tudo isolado em `src/modules/disparos/`):**
- `components/PublicoTab.tsx`, `components/AudienceWizardDialog.tsx`, `components/AudienceCsvMapper.tsx`, `components/AudienceFilterBuilder.tsx`, `components/AudienceContactsTable.tsx`, `components/AudienceRefreshDialog.tsx`.
- `hooks/useDspAudiences.ts` (lista/CRUD/arquivar), `hooks/useDspAudienceContacts.ts` (paginado), `hooks/useDspAudienceResolve.ts` (preview/refresh).
- `lib/audienceCsv.ts` (parse + mapeamento + validação, reaproveitando a normalização já existente).
- Registro da aba em `pages/DisparosPage.tsx` e ajuste do passo de audiência em `components/CampaignWizardDialog.tsx`.

**Backend de disparo:** `dsp-campaign-prepare` passa a checar `audience_mode`; quando for `audience`, monta `dsp_recipients` a partir de `dsp_audience_contacts` com `status = 'active'` (mantendo supressão, validação e limites atuais intactos). O caminho `inline` continua exatamente como está hoje.
