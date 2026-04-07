
## Correção das permissões no banco para o usuário advogado

### Diagnóstico
O problema não é só o redirecionamento do frontend: hoje o acesso do advogado depende de a permissão `adv_dashboard` existir de verdade no banco externo.

Pelos arquivos atuais, há 4 pontos frágeis:

1. `adv_dashboard` pode não existir na tabela `modules`.
2. O `ensure_adv_module` só cria permissões padrão se o módulo for inserido naquele momento; se o módulo já existir sem as permissões corretas, ele não corrige.
3. `insert_team_member` auto-adiciona `adv_dashboard` para advogado, mas `update_team_member` ainda não faz isso.
4. O `ProtectedRoute` usa `usePermission`, e esse hook ainda lê o map direto; então, sem registro real no banco, o advogado continua barrado.

### O que precisa ser feito
#### 1. Corrigir os dados no banco externo
Criar uma ação de reparo no `db-query` para:

- garantir que o módulo `adv_dashboard` exista em `modules`
- garantir que exista `role_default_permissions` para `advogado` nesse módulo
- garantir que o usuário advogado atual receba `user_permissions` para `adv_dashboard`
- fazer isso com lógica idempotente (`INSERT ... ON CONFLICT DO NOTHING`) para poder rodar sem risco

Como você pediu correção “no banco”, esse é o ponto principal.

#### 2. Aplicar também para advogados já existentes
Além do usuário atual, vale backfill para todos os usuários com role `advogado`, porque já há indício de usuários criados antes da correção automática.

Fluxo do reparo:
```text
modules
  -> garantir adv_dashboard
role_default_permissions
  -> garantir advogado + adv_dashboard
user_permissions
  -> garantir adv_dashboard para advogados existentes
```

#### 3. Corrigir a atualização de membros
Em `supabase/functions/db-query/index.ts`, ajustar `update_team_member` para repetir a mesma regra de `insert_team_member`:

- se `role === 'advogado'`, incluir `adv_dashboard` automaticamente antes de gravar `user_permissions`

Hoje esse é um dos motivos de um usuário poder virar advogado e continuar sem acesso.

#### 4. Tirar a dependência da página protegida
Hoje `AdvDashboardPage` tenta chamar `ensureAdvModule()` no `useEffect`, mas isso acontece tarde demais, porque a página só monta depois que a permissão já foi aprovada.

Plano:
- mover essa garantia para antes do acesso protegido, idealmente no fluxo de login/bootstrap
- manter a página sem responsabilidade de “consertar” o banco

#### 5. Alinhar o guard do frontend como safety net
Mesmo corrigindo o banco, ainda vale alinhar `src/hooks/usePermission.ts` com `AuthContext.hasPermission()`.

Assim:
- `ProtectedRoute` passa a respeitar a mesma regra central
- evita nova divergência entre “o contexto libera” e “o hook bloqueia”

### Arquivos a ajustar
- `supabase/functions/db-query/index.ts`
  - tornar `ensure_adv_module` realmente corretivo, não só criador
  - adicionar reparo para usuário(s) advogado(s) já existentes
  - corrigir `update_team_member` para auto-incluir `adv_dashboard`
- `src/hooks/usePermission.ts`
  - delegar checagens para `hasPermission()` do contexto
- `src/pages/adv/AdvDashboardPage.tsx`
  - remover a responsabilidade de garantir módulo/permissão ali
- opcionalmente `src/contexts/AuthContext.tsx`
  - disparar a garantia em ponto anterior ao acesso da rota, se necessário

### Resultado esperado
Depois da implementação:

- o módulo `adv_dashboard` existirá de fato no banco
- o usuário advogado atual terá a permissão gravada no banco
- advogados futuros e advogados editados depois também receberão essa permissão automaticamente
- o acesso a `/adv/dashboard` deixará de redirecionar para `/login`
