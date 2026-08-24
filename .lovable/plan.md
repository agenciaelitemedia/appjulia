# Plano: Redirecionamento pós-login para /chat

## Objetivo
Ajustar o redirecionamento após login para que usuários **não-proprietários** do `client_id` e com permissão de acesso ao `/chat` sejam enviados diretamente para `/chat`; caso contrário, vão para `/dashboard`.

## Contexto atual
- `src/pages/Login.tsx` já redireciona para `/chat` quando `hasPermission('chat', 'view')` é verdadeiro.
- A regra de "owner/titular" do escritório está centralizada em `src/lib/auth/isOwner.ts` (`isOwnerUser`), que considera owner os papéis `admin`, `user` e `colaborador`.

## Mudanças
1. Em `src/pages/Login.tsx`:
   - Importar `isOwnerUser` de `@/lib/auth/isOwner`.
   - Adicionar `user` ao destructuring do `useAuth()`.
   - Calcular a rota pós-login com a nova regra:
     ```text
     SE !isOwnerUser(user) E hasPermission('chat', 'view')
       → '/chat'
     SENÃO
       → '/dashboard'
     ```
   - Aplicar a mesma rota tanto no `<Navigate>` de usuário já autenticado quanto no `navigate()` após login bem-sucedido.

2. Validação:
   - Executar `tsc --noEmit` para garantir que não há erros de tipo.

## Escopo
- Apenas frontend (`src/pages/Login.tsx`).
- Nenhuma alteração em backend, RLS, banco ou outras rotas.
