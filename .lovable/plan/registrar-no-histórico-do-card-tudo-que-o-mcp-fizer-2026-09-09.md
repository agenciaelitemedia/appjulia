# Registrar no histórico do card tudo que o MCP fizer

## Situação verificada

Hoje, no conector MCP:

- **Criar card** (`julia_card_criar`) já grava um evento no histórico do card (`created`).
- **Editar card** (`julia_lead_atualizar`), **mover etapa/status** (`julia_lead_alterar_estagio`) e
  **definir responsável** (`julia_lead_atribuir_responsavel`) **não gravam nada no histórico** —
  ficam apenas na auditoria interna (`cop_write_audit`), que não aparece no card.

Resultado: quem abre o card não vê que a mudança veio do MCP.

## O que será feito

Passar a gravar um evento no histórico do card em toda escrita aplicada pelo MCP:

| Ação do MCP | Evento no histórico | Conteúdo |
|---|---|---|
| Editar campos | `updated` | campos alterados (antes → depois) e observação "Alterado via MCP" |
| Mover etapa | `moved` | etapa de origem e destino |
| Mudar status para ganho/perda | `won` / `lost` | status anterior e novo |
| Definir responsável | `updated` | responsável anterior e novo |

Regras:

- O evento só é gravado quando a ação é **realmente aplicada**; simulação (`dry_run`) não gera histórico.
- Autor do evento identificado como o e-mail da conexão MCP (ou "MCP" quando não houver), para
  ficar claro na linha do tempo do card quem fez.
- A observação inclui o identificador da auditoria, permitindo rastrear a chamada exata.
- Falha ao gravar o histórico **não desfaz nem quebra** a operação — segue registrada em auditoria.

## Detalhes técnicos

- Arquivo: `supabase/functions/_shared/copiloto/tools/escrita.ts`.
- Helper único (ex.: `logDealHistory`) inserindo em `crm_deal_history` com
  `deal_id`, `action`, `from_pipeline_id`, `to_pipeline_id`, `changed_by`, `changes`, `notes`.
  Ações restritas ao conjunto já usado pela UI: `created | moved | updated | note_added | won | lost | archived`.
- Chamado após o `update` bem-sucedido em `julia_lead_atualizar`, `julia_lead_alterar_estagio`
  e `julia_lead_atribuir_responsavel` (apenas na parte de `crm_deals`), envolvido em try/catch.
- Quando a movimentação também muda status para `won`/`lost`, gravar dois eventos (`moved` + `won`/`lost`)
  ou apenas o de status quando não houver troca de etapa.
- Sem migração de banco. Verificação: `bunx tsgo --noEmit`, deploy de `copiloto-mcp` e uma
  movimentação/edição real conferindo o histórico no card do CRM Builder.
