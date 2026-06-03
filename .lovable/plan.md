## Problema

Em `src/components/chat/ChatList.tsx` (linha 1349-1363), o filtro "Atendente" só passa `teamMembers` para `TeamMemberSelect` quando `isAdmin || user?.role === 'user'`. Outros roles ficam sem a lista.

## Mudança

Ampliar a condição para incluir também o role `colaborador`, mantendo `admin` e `user`.

### Edição

`src/components/chat/ChatList.tsx` — linha 1350:

```tsx
// antes
members={(isAdmin || user?.role === 'user') ? teamMembers : []}

// depois
members={(isAdmin || user?.role === 'user' || user?.role === 'colaborador') ? teamMembers : []}
```

Nenhuma outra lógica é alterada — os demais roles continuam vendo apenas "Todos / Meus / Aguardando Atendimento".
