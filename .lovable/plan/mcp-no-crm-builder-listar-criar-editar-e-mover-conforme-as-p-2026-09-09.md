# MCP no CRM Builder: listar, criar, editar e mover conforme as permissões do quadro

## Situação verificada agora

As ferramentas já existem e já obedecem às permissões do quadro:

- Listar: `julia_builder_listar_quadros`, `julia_builder_listar_negocios`, `julia_builder_obter_negocio`
- Criar: `julia_card_criar`
- Editar: `julia_lead_atualizar`
- Mover (etapa/status): `julia_lead_alterar_estagio`
- Apoio: `julia_lead_atribuir_responsavel`, `julia_contatos_buscar`, `julia_contatos_obter_perfil`, `julia_contato_criar`, `julia_contato_atualizar`

O quadro aberto ("Funil comercial Julia IA", escritório 30) já está com as quatro opções ligadas.
Os outros quadros estão sem nenhuma opção — ou seja, invisíveis para o MCP, como combinado.

O que falta é publicar a versão mais recente do conector: as últimas alterações
(identificação da conexão, correção da lista de agentes) ainda não foram para o ar.

## O que será feito

1. **Publicar o conector** (`copiloto-mcp`) para que a checagem de permissão por quadro e as
   correções recentes passem a valer em produção.
2. **Validar com chamadas reais** usando um token do escritório 30:
   - listar quadros → deve trazer apenas "Funil comercial Julia IA";
   - listar e abrir negócios desse quadro → deve responder sem erro;
   - criar, editar e mover um card em simulação (`dry_run`) → deve ser aceito;
   - repetir uma dessas ações em um quadro sem permissão → deve ser recusado com mensagem clara.
3. **Registrar o resultado** e, se alguma ferramenta ainda falhar, corrigir na mesma passada
   (ex.: coluna inexistente, filtro de escritório) e publicar de novo.
4. **Guia curto na página do conector**: listar quais ferramentas atendem cada ação e lembrar que
   o acesso vem do bloco "Acesso do MCP" nas permissões do quadro, com o ID do quadro copiável.

## Detalhes técnicos

- Enforcement em `supabase/functions/_shared/copiloto/board-access.ts`
  (`getBoardMcpAccess`, `assertBoardMcpAccess`, `listMcpAllowedBoardIds`), consumido por
  `tools/crm.ts` (list) e `tools/escrita.ts` (create/edit/move). Padrão fechado: ausência = negado.
- Escritório sempre derivado do token OAuth; escrita mantém `dry_run` padrão, `approved_by`,
  `idempotency_key`, `expected_version` e auditoria em `cop_write_audit`.
- Deploy: `copiloto-mcp` (inclui `_shared/copiloto/*`). Sem migração de banco.
- Validação por chamadas MCP autenticadas; se não houver token utilizável, valido as consultas
  equivalentes no banco e informo o que dependeu de teste manual.
