# Plano: Perfil — Permissão de edição + Foto individual por usuário

## 1. Restringir edição de "Dados do Cliente"

Em `src/pages/profile/ProfileSettingsPage.tsx`:

- Computar `canEditClient = user?.role === 'user'` (dono do escritório/clientId).
- Aplicar `disabled={!canEditClient}` em **todos** os inputs do bloco "Dados do Cliente" (nome, razão social, CPF/CNPJ, e-mail, telefone, CEP, endereço, etc.) e no botão "Salvar".
- Exibir um `Alert` discreto acima do formulário quando `!canEditClient`:
  > "Somente o proprietário da conta pode editar os dados do cliente."
- A busca de CEP também fica desabilitada.
- Não bloquear a leitura — todos continuam vendo os dados.

## 2. Foto de perfil individual por usuário

Hoje a foto vem de `clients.photo` (compartilhada entre todos os usuários do mesmo `client_id`). Vamos manter `clients.photo` como **foto da empresa** (intacta) e introduzir foto **por usuário**, sem alterar o schema do banco externo.

### 2.1 Backend (Lovable Cloud)

Nova migração criando a tabela `public.user_avatars`:

```sql
CREATE TABLE public.user_avatars (
  user_id    bigint PRIMARY KEY,
  photo_url  text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_avatars TO authenticated;
GRANT SELECT ON public.user_avatars TO anon;
GRANT ALL ON public.user_avatars TO service_role;

ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

-- O projeto usa auth externo (não auth.uid). Seguimos o padrão das demais
-- tabelas: leitura aberta a authenticated/anon, escrita validada no client.
CREATE POLICY "user_avatars read"  ON public.user_avatars FOR SELECT USING (true);
CREATE POLICY "user_avatars write" ON public.user_avatars FOR ALL USING (true) WITH CHECK (true);
```

Bucket `avatars` (já existe, público). Caminho de upload novo: `user_{userId}/{timestamp}.{ext}`. Não tocamos no caminho atual `client_{clientId}/...` (continua sendo a foto da empresa).

### 2.2 Frontend

**a) `src/pages/profile/ProfileSettingsPage.tsx`**
- `handlePhotoChange` passa a fazer upload para `user_{user.id}/...` e grava em `public.user_avatars` via `supabase.from('user_avatars').upsert({ user_id: user.id, photo_url })`.
- O `<AvatarImage src=...>` deste card mostra a foto do **usuário logado** (estado local `userPhoto`), com fallback para iniciais — não mais `clientData.photo`.
- Carregar `userPhoto` no mount via `supabase.from('user_avatars').select('photo_url').eq('user_id', user.id).maybeSingle()`.

**b) `src/contexts/AuthContext.tsx`**
- Trocar `hydrateClientPhoto` por `hydrateUserAvatar`:
  - Cache em `localStorage` por `user.id` (chave `auth_user_photo_cache_v1`).
  - Busca em background `user_avatars.photo_url` pelo `user.id`.
  - Fallback: se não existir registro, mantém o comportamento atual (busca `clients.photo`) — assim quem nunca trocou continua vendo a foto da empresa.
  - Atualiza `user.avatar` com a URL resultante.
- Continua expondo `user.avatar`, então **todos os lugares que já usam `user.avatar`** (header, sidebar, etc.) passam a refletir a foto individual sem mudanças.
- Manter `client_name` hidratado a partir de `clients.name`.

### 2.3 Por que essa abordagem é segura
- Não altera schema do banco externo (zero risco para módulos legados).
- `clients.photo` continua existindo e segue sendo a "foto da empresa" (poderá ser exposta no futuro como logo).
- Bucket já é público — apenas novo prefixo de path, sem mudar policies de storage.
- AuthContext mantém contrato (`user.avatar`), preservando todos os consumidores.

## 3. Arquivos afetados

- **Migração nova** em `supabase/migrations/` (tabela `user_avatars` + grants + RLS).
- `src/pages/profile/ProfileSettingsPage.tsx` — gating de edição, upload + leitura por usuário.
- `src/contexts/AuthContext.tsx` — hidratação do avatar via `user_avatars` com fallback para `clients.photo`.

Nenhuma alteração em componentes que apenas consomem `user.avatar`.
