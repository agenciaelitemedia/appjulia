

# Card do CRM Comercial: layout igual ao da Julia

## Resumo

Reestruturar o `ComercialLeadCard` para seguir o mesmo layout do `CRMLeadCard` da Julia: cod_agent abaixo do nome, icones de ação numa barra abaixo do cod_agent, e datas de criação/atualização no rodape.

## Alteração: `src/pages/comercial/crm/components/ComercialLeadCard.tsx`

Layout final (seguindo a Julia):

1. **Header**: Nome + badge Vellip (se origin === 'vellip') | botão Eye (direita)
2. **Telefone**: abaixo do nome, indentado
3. **Cod Agent**: badge `[cod_agent]` com icone Hash (se existir)
4. **Empresa / Valor**: linhas opcionais (como já existe)
5. **Barra de icones**: Phone (condicional ao `isAvailable`) e Eye numa linha horizontal, estilo rounded-full como na Julia
6. **Rodape com border-t**: Criado + data, Atualizado + data, Na fase + tempo — usando `formatDbDateTime`

Imports a adicionar: `Hash`, `formatDbDateTime` de `@/lib/dateUtils`

Remover o botão Eye do header (mover para barra de icones) e reorganizar o layout para ficar idêntico ao da Julia.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/comercial/crm/components/ComercialLeadCard.tsx` | Reestruturar layout: cod_agent badge, barra de icones, datas criação/atualização |

