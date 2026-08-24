# Importar cards no CRM por arquivo .csv

Adiciona um botão **Importar CSV** na barra do quadro do CRM (Painel CRM / CRM Builder), abrindo um assistente que lê a planilha, mostra a prévia com validação e cria os cards na etapa escolhida.

## Fluxo do assistente (3 passos)

1. **Arquivo**
   - Upload de `.csv` (ou colar o conteúdo, como já acontece na importação de processos do DataJud).
   - Detecta o separador automaticamente (`,` ou `;`) e aceita cabeçalho em português.
   - Link "baixar modelo .csv" gera um arquivo de exemplo com as colunas suportadas.

2. **Mapeamento e opções**
   - Cada coluna do arquivo é associada a um campo do card. Colunas com nome reconhecido já vêm pré-mapeadas.
   - Campos suportados: `titulo` (obrigatório), `descricao`, `valor`, `prioridade`, `nome`, `telefone`, `email`, `tags`, `responsavel`, `data_prevista` — mais todos os **campos adicionais** já criados no quadro.
   - Seleção da **etapa de destino**: uma etapa única para todo o arquivo (escolhida aqui).
   - Checkbox **"Ignorar linhas duplicadas"** (ligada por padrão): compara telefone (normalizado) e e-mail com os cards já existentes no quadro e com as próprias linhas do arquivo.

3. **Prévia e confirmação**
   - Tabela com as primeiras linhas, contadores de **válidas / com erro / duplicadas** e o motivo em cada linha inválida.
   - Só as linhas válidas são importadas; o botão mostra a quantidade ("Importar 143 cards").
   - Durante a gravação: barra de progresso por lotes; ao final, resumo com criados/ignorados/falhas e opção de baixar um CSV de erros.

## Regras de tratamento dos dados

- **Título**: obrigatório; se vazio, usa o nome do contato. Sem nenhum dos dois, a linha é inválida.
- **Valor**: aceita `1.234,56`, `1234.56` e `R$ 1.200`; inválido vira 0 com aviso na linha.
- **Prioridade**: aceita baixa/média/alta/urgente (e os equivalentes em inglês); default média.
- **Telefone**: normalizado só com dígitos, tolerando variações de DDI e do nono dígito (mesma normalização já usada na busca do CRM).
- **Tags**: separadas por `,` ou `;` dentro da célula.
- **Data prevista**: aceita `dd/mm/aaaa` e `aaaa-mm-dd`.
- **Campos adicionais**: validados pelo tipo do campo (número, data, seleção); valor fora das opções vira aviso e o campo fica vazio.
- **Contato do chat**: se o telefone já existir em um contato do chat, o card é criado vinculado a ele (mesmo comportamento de "Novo Card"). Contatos novos **não** são criados.
- **Limite**: 2.000 linhas por importação, para não travar o navegador.

## Permissões

O botão só aparece para quem já pode criar cards no quadro (mesma permissão de "Novo Card"), e a criação em lote respeita a checagem de permissão existente.

## Detalhes técnicos

- `src/pages/crm-builder/lib/csvImport.ts` (novo): parser de CSV sem dependência nova (aspas, separador, BOM), detecção de cabeçalho, mapeamento automático, normalizadores (valor, telefone, data, prioridade, tags) e função de validação que devolve `{ rows, errors, duplicates }`.
- `src/pages/crm-builder/components/deals/ImportDealsCsvDialog.tsx` (novo): assistente de 3 passos, usando `Dialog`, `Table`, `Progress` e `Select` já existentes; recebe `pipelines`, `customFields`, `existingDeals` e a função de criação.
- `src/pages/crm-builder/hooks/useImportDealsCsv.ts` (novo): grava em lotes de 100 via `supabase.from('crm_deals').insert([...])` reaproveitando o payload do `createDeal` (board_id, client_id, cod_agent, position sequencial a partir do máximo atual da etapa, `custom_fields`, `created_by`), resolve o `contact_id` do chat por telefone em uma consulta única e registra o histórico/auditoria como na criação individual. Ao terminar, chama `fetchDeals()` para atualizar o quadro.
- `src/pages/crm-builder/BoardPage.tsx`: botão **Importar CSV** ao lado de "Novo Card" (visível conforme permissão) e montagem do diálogo.
- Sem migração de banco: usa as tabelas `crm_deals`, `crm_deal_history` e `chat_contacts` como estão.
