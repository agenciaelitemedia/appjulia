

# Dupla confirmação na exclusão + Adicionar colaborador manual

## Resumo

Duas melhorias no card "Colaboradores Julia":
1. Ao remover um colaborador selecionado, abrir AlertDialog com dupla confirmação (digitar nome + checkbox)
2. Botão para adicionar colaborador manual informando nome, email e telefone (sem vínculo com banco externo)

## 1. Exclusão com dupla confirmação

Ao clicar no `X` de um selecionado, abrir `AlertDialog` com:
- Texto: "Deseja remover **{nome}** dos colaboradores?"
- Input para digitar o nome do colaborador (deve coincidir)
- Checkbox "Confirmo a remoção deste colaborador"
- Botão "Remover" habilitado somente quando ambos estão corretos
- Seguir padrão já usado em `LegalCasesTab.tsx`

## 2. Adicionar colaborador manual

No header da lista "Disponíveis", adicionar botão "Adicionar manual" que abre um `Dialog` com:
- Campo Nome (obrigatório)
- Campo Email (opcional)
- Campo Telefone (opcional)
- Botão "Adicionar" que insere direto em `support_team_members` com `user_id: null` e `role: 'manual'`
- Após inserir, aparece na lista de selecionados

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `SupportTeamConfig.tsx` | Adicionar AlertDialog de exclusão com dupla confirmação + Dialog para adicionar colaborador manual |

