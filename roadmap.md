Migrar todo o projeto de Lovable Cloud para um Supabase Externo.

## Painel de memória por contato

- [x] Criar armazenamento seguro e auditável para memórias por contato.
- [x] Criar função protegida para listar, gerar, incluir, editar e arquivar memórias.
- [x] Transcrever áudios pendentes somente ao clicar em “Gerar memória”.
- [x] Adicionar aba principal Memória e subaba Documentos nos dois chats.
- [x] Incorporar resumos existentes, fontes, áudio reproduzível e permissões definidas.
- [x] Validar isolamento por escritório, permissões, desktop, celular, typecheck e build.

- [ ] Criar documento `docs/Plano-Migracao-Supabase.md` (já feito).
- [ ] Salvar memória do plano em `mem/features/migracao-supabase/kit-migracao.md` e indexar.
- [ ] Criar tela `/migracao` (admin) com passo a passo.
- [ ] Criar Edge Function `migracao-executar` com ações: precheck, schema, data_chunk, postschema, security, storage_chunk, verify.
- [ ] Criar tabelas de controle `migration_runs` e `migration_steps`.
- [ ] Gerar scripts SQL de introspecção (extensões, tabelas, sequences, funções, constraints, índices, triggers, matviews, grants/RLS, buckets, cron).
- [ ] Listar as 23 secrets e as ~141 Edge Functions para o painel manual.
- [ ] Instruir sobre Fase A (pré-cópia sem parada) e Fase B (cutover ≤ 2h).
- [ ] Validar build e typecheck.
