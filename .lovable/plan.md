

# Filtrar usuários que já possuem ramal no seletor

## Problema
Ao criar um novo ramal, o dropdown mostra todos os membros da equipe, inclusive os que já têm ramal vinculado. Deveria filtrar quem já possui.

## Solução

### `RamalDialog.tsx`
- Receber `extensions` (lista de ramais existentes) como nova prop
- Ao montar `memberOptions`, filtrar membros cujo `id` já aparece como `assigned_member_id` em alguma extensão existente
- Exceção: ao editar, não filtrar o membro atualmente vinculado ao ramal sendo editado
- Se o usuário logado já tem ramal, não aparece na lista (a menos que esteja editando o ramal dele)

### `MeusRamaisTab.tsx`
- Passar `extensions` como prop ao `RamalDialog`

## Arquivos alterados
- `src/pages/telefonia/components/RamalDialog.tsx` — filtro + nova prop
- `src/pages/telefonia/components/MeusRamaisTab.tsx` — passar extensions

