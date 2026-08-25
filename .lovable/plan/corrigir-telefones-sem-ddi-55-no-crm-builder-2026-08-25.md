# Corrigir telefones sem DDI 55 no CRM Builder

Confirmado no banco: no quadro aberto (`9967b549…`) há 88 cards com telefone e **81 deles estão sem o 55** — são números de 11 dígitos (DDD + 9 dígitos), ex. `81984042144`, `92981827416`. No sistema inteiro existem 94 registros de 11 dígitos e 2 de 10 dígitos, além de alguns com máscara (`(98) 98500-5211`).

## O que será feito

1. **Correção dos dados existentes** (atualização única no banco, sem migração de schema):
   - Números com **11 dígitos** (DDD 11–99 + 9 dígitos começando em 6–9) → passam a `55 + número`.
   - Números com **10 dígitos** (celular antigo sem o 9) → passam a `55 + DDD + 9 + número`, seguindo a mesma regra do `normalizeBrPhone`.
   - Números com máscara (`(98) 98500-5211`) → limpos para somente dígitos e depois corrigidos pela mesma regra.
   - **Não serão tocados**: números que já começam com 55, internacionais (12–13 dígitos com outro DDI, ex. `5493415598109`, `14152126297`), IDs de grupo do WhatsApp (18 dígitos) e valores claramente inválidos (`11111111111`).
   - Escopo: por padrão apenas o quadro atual. Se preferir, aplico em todos os quadros do escritório no mesmo passo.

2. **Evitar recorrência na importação**: o import de CSV do CRM passa a normalizar o telefone com `normalizeBrPhone` antes de gravar em `crm_deals.contact_phone`, garantindo sempre o formato canônico com DDI.

3. **Revinculação ao chat**: após a correção, os cards passam a casar com `chat_contacts.phone` (que já é canônico com 55), então os botões de WhatsApp / ZAP Call / abrir conversa voltam a funcionar nesses cards.

## Detalhes técnicos

- Correção via `UPDATE public.crm_deals` usando `regexp_replace(contact_phone,'\D','','g')` e `CASE` para os casos de 11 e 10 dígitos, filtrando `contact_phone !~ '^55'` e validando DDD/primeiro dígito local. Executado com a ferramenta de dados (não é mudança de schema).
- `src/pages/crm-builder/lib/csvImport.ts` / `useImportDealsCsv.ts`: aplicar `normalizeBrPhone` no valor de `contact_phone` do payload de inserção (hoje o telefone é usado normalizado apenas para buscar o contato do chat, mas gravado como veio do arquivo).
- Sem alteração de RLS, tabelas ou colunas.
