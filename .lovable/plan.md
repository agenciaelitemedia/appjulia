
## Contexto

Quadro `Processos ADM` (`108bb2c7…`) está com `settings.permission_mode = "role"` e possui a regra:

- `role:time` → view/create/edit ✅, delete ❌
- `user:167` → view/create/edit ✅ (herança do modo "user" anterior)

A lógica em `useCRMBoardPermissions.ts` e `useCRMBoards.ts` casa `subject_id === user.role`. No banco, `users.role` já está em minúsculas (`time`, `advogado`, `comercial`), então em teoria bateria. Mesmo assim, o usuário reporta que só o modo Usuário está funcionando na prática.

## Diagnóstico provável

A hipótese com maior probabilidade, pelo que li no código, é a regra de "dono do cliente" em `isClientOwnerUser`:

```ts
if (u.role === 'admin') return true;
return Boolean(u.client_id) && !u.user_id;
```

Isso trata como **dono** qualquer usuário titular (`role = 'user'`, `client_id` setado e sem `user_id`), dando acesso total a todos os quadros — inclusive ignorando regras por perfil. Ou seja:

- Se você está testando o modo "Perfil" logado como um usuário titular (`role = user`), sempre verá o quadro, dando a impressão de que "perfil não filtra".
- Testar como membro de equipe (`role = time/advogado/comercial`) é o único caminho válido para o filtro por Perfil ter efeito.

Para membros de equipe (`user_id` setado), o gate por Perfil deveria funcionar. Se ainda assim não estiver filtrando, o mais provável é uma das duas causas:
1. Cache local do React Query com a lista antiga do quadro carregada antes das regras — a chave da query é `['crm-boards', clientId, userId, role]`, mas o realtime channel só invalida `['crm-boards', clientId]` (prefixo), então deveria bater; **precisamos confirmar via preview real com um usuário de equipe.**
2. Alguma regra órfã do modo "user" (como o `user:167` visto no banco) causando confusão na UI de configuração, apesar de não afetar o filtro (o filtro usa só regras `role` quando o modo é `role`).

## Plano de investigação e correção

1. **Confirmar comportamento real via preview** com Playwright headless:
   - Login como usuário `role = time` do cliente 300 (ex.: `adriellef743@gmail.com`) e verificar se o quadro `Processos ADM` aparece em `/crm-builder` e se as ações Criar/Editar respeitam a regra.
   - Login como `role = advogado` (Dra. Neiva) e confirmar que o quadro **não** aparece (não há regra para `advogado`).
   - Login como titular (`role = user`) e reproduzir o cenário do usuário — se o quadro aparecer mesmo sem regra `role:user`, a causa é o "owner bypass".

2. **Corrigir de acordo com o resultado**:
   - **Se o problema for o owner bypass**: relaxar `isClientOwnerUser` de forma que titulares (`role = 'user'` sem `user_id`) continuem sendo tratados como donos apenas para gerenciar (`canManage`), mas passem pela filtragem de regras quando o modo for `role` ou `user`. Manter admin sempre com acesso total. Ajustar tanto `useEffectiveBoardPermission` quanto o filtro em `useCRMBoards.queryFn` para separar “dono → pode gerenciar regras” de “dono → sempre vê tudo”.
   - **Se o problema for cache/realtime**: garantir que `useCRMBoards` também invalide a query quando `crm_boards.settings.permission_mode` mudar (o canal atual já cobre UPDATE de `crm_boards`, mas confirmar). Se necessário, incluir a coluna `settings` no `queryKey` ou invalidar por prefixo `['crm-boards']`.
   - **Se for regra órfã na UI**: limpar as regras `subject_type = 'user'` que sobraram do modo anterior e/ou fazer a UI ocultar regras que não correspondem ao modo atual (evita confusão visual, sem alterar o filtro).

3. **Regravar checagem manual** após ajustes: repetir o passo 1 e validar que:
   - Titular (`role = user`) só vê quadros com modo `disabled` ou com regra explícita `role:user` / `user:<id>` (se admin decidiu incluí-lo).
   - Admin sempre vê tudo.
   - Team members enxergam apenas o que a regra permite.

## Perguntas antes de implementar

Antes de mexer, preciso confirmar com você:

1. **Qual comportamento você espera para o dono do cliente (usuário titular `role = user`)?**
   a) Ele deve ser tratado como admin do próprio CRM e ver **todos** os quadros, ignorando regras (comportamento atual).
   b) Ele deve **respeitar** as regras por Perfil/Usuário como qualquer outro membro, exceto na tela de configuração (onde continua podendo editar as regras).

2. **Com qual usuário e perfil você testou** quando percebeu que "só usuário funciona"? (email ajuda a reproduzir).
