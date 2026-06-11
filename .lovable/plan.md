## Objetivo
Adicionar dois novos campos na seção "Informações para Contrato" do diálogo **Personalizar Caso** (`/admin/prompts`):
- **Estado Civil** → valor `{{Estado Civil}}`
- **Nacionalidade** → valor `{{Naturalidade}}`

## Escopo da mudança
A lista de campos é renderizada a partir de `DEFAULT_CONTRACT_FIELDS` no arquivo `src/pages/admin/prompts/constants/promptDefaults.ts`. Basta incluir os dois novos itens nesse array.

## Passos
1. Editar `src/pages/admin/prompts/constants/promptDefaults.ts`:
   - Adicionar `{ label: 'Estado Civil', value: '{{Estado Civil}}', checked: false }`
   - Adicionar `{ label: 'Nacionalidade', value: '{{Naturalidade}}', checked: false }`

2. Verificar que o diálogo `CaseCustomizeDialog.tsx` já consome esse array via fallback e renderiza os novos campos automaticamente.

Nenhuma outra alteração é necessária.