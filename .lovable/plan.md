

# Plano: Botao "Editar Perfil" na Pagina de Permissoes

## Visao Geral

Adicionar um botao "Editar Perfil" no cabecalho do `UserPermissionEditor` que abre um dialog para editar os dados cadastrais do usuario selecionado: nome, email, status (ativo/inativo), perfil (role) e opcao de resetar senha.

---

## Estrutura de Arquivos

```text
src/pages/admin/permissoes/
  components/
    UserEditDialog.tsx        <- NOVO: Dialog para editar perfil do usuario
    ResetPasswordSection.tsx  <- NOVO: Secao de reset de senha dentro do dialog
  hooks/
    usePermissionsAdmin.ts    <- ATUALIZAR: Adicionar mutations para update/reset
```

---

## Fluxo de Uso

```text
+-------------------------------------------------------------------+
|  UserPermissionEditor (usuario selecionado)                       |
+-------------------------------------------------------------------+
|  [Avatar] Maria Silva                              [Editar Perfil]|
|           maria@email.com              Badge: Colaborador         |
+-------------------------------------------------------------------+
|                                                                   |
|  ... matriz de permissoes ...                                     |
|                                                                   |
+-------------------------------------------------------------------+

         |
         v  (clique em "Editar Perfil")

+-------------------------------------------------------------------+
|  Dialog: Editar Perfil do Usuario                            [X]  |
+-------------------------------------------------------------------+
|                                                                   |
|  Nome:   [Maria Silva________________________]                    |
|                                                                   |
|  Email:  [maria@email.com____________________]                    |
|                                                                   |
|  Perfil: [Colaborador v]  (dropdown: admin, colaborador, user)    |
|                                                                   |
|  Status: [x] Usuario ativo                                        |
|                                                                   |
|  +---------------------------------------------------------+      |
|  |  Redefinir Senha                                        |      |
|  |                                                         |      |
|  |  Clique para gerar uma nova senha temporaria.           |      |
|  |                              [Redefinir Senha]          |      |
|  +---------------------------------------------------------+      |
|                                                                   |
|                            [Cancelar]  [Salvar Alteracoes]        |
+-------------------------------------------------------------------+
```

---

## Componentes

### 1. UserEditDialog.tsx

Dialog com formulario para editar dados do usuario:

**Campos:**
- **Nome** (Input text, obrigatorio)
- **Email** (Input email, com validacao de unicidade)
- **Perfil/Role** (Select dropdown)
  - Opcoes: Administrador, Colaborador, Usuario, Time
  - Desabilitado para o proprio usuario logado (nao pode mudar proprio role)
- **Status** (Switch ou Checkbox)
  - "Usuario ativo" - true/false
  - Desabilitado para o proprio usuario logado
- **Secao Redefinir Senha**
  - Botao que gera nova senha temporaria
  - Exibe a senha gerada para copiar

**Comportamentos:**
- Ao abrir, preenche com dados atuais do usuario
- Validacao de email unico (reusa `checkUserEmailExists`)
- Ao salvar, chama endpoint de update
- Exibe toast de sucesso/erro

### 2. Atualizacao do UserPermissionEditor.tsx

Adicionar botao "Editar Perfil" no header:

```text
<Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
  <Pencil className="w-4 h-4 mr-2" />
  Editar Perfil
</Button>
```

---

## Backend (Edge Function)

Criar novo endpoint `update_user_profile`:

```sql
UPDATE users 
SET name = $1, 
    email = $2, 
    role = $3, 
    is_active = $4,
    status = $5,
    updated_at = now()
WHERE id = $6
RETURNING id, name, email, role, is_active, status
```

**Campos atualizados:**
- `name` - nome do usuario
- `email` - email (com validacao previa)
- `role` - perfil (admin, colaborador, user, time)
- `is_active` - flag de usuario ativo
- `status` - status legacy (manter sincronizado com is_active)

---

## Hooks (usePermissionsAdmin.ts)

Adicionar novas mutations:

```typescript
// Atualizar dados do usuario
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: number;
      name: string;
      email: string;
      role: AppRole;
      isActive: boolean;
    }) => {
      return externalDb.updateUserProfile(data.userId, {
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      toast({ title: 'Perfil atualizado com sucesso' });
    },
  });
}

// Resetar senha do usuario
export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: number) => {
      const rawPassword = generatePassword(); // Julia@XXXX
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await externalDb.resetUserPassword(userId, hashedPassword, rawPassword);
      return { temporaryPassword: rawPassword };
    },
    onSuccess: () => {
      toast({ title: 'Senha redefinida com sucesso' });
    },
  });
}
```

---

## ExternalDb (src/lib/externalDb.ts)

Adicionar metodo:

```typescript
async updateUserProfile(
  userId: number, 
  data: { name: string; email: string; role: string; isActive: boolean }
): Promise<UserWithPermissions> {
  const result = await this.invoke({
    action: 'update_user_profile',
    data: { userId, ...data },
  });
  return result[0];
}
```

---

## Validacoes e Regras de Negocio

| Regra | Descricao |
|-------|-----------|
| Email unico | Validar antes de salvar se email ja existe para outro usuario |
| Auto-edicao | Usuario logado nao pode alterar seu proprio role ou status |
| Role admin | Alertar antes de rebaixar um admin para outro role |
| Time vinculado | Usuario TIME nao pode ter role alterado para admin |
| Senha temporaria | Salva no campo `remember_token` para referencia |

---

## Estados do Dialog

```text
ESTADO 1: Formulario de edicao
  - Campos editaveis
  - Botao "Salvar Alteracoes"
  - Secao de reset de senha colapsavel

ESTADO 2: Senha redefinida (apos clicar em Redefinir)
  - Exibe a nova senha temporaria
  - Botao "Copiar"
  - Mensagem orientando trocar no primeiro acesso
```

---

## Tarefas de Implementacao

1. Criar endpoint `update_user_profile` na Edge Function `db-query`
2. Adicionar metodo `updateUserProfile` no `externalDb.ts`
3. Criar hook `useUpdateUserProfile` no `usePermissionsAdmin.ts`
4. Criar hook `useResetUserPassword` no `usePermissionsAdmin.ts` (reutilizar logica existente)
5. Criar componente `UserEditDialog.tsx`
6. Atualizar `UserPermissionEditor.tsx` com botao e integracao do dialog
7. Testar fluxo completo

---

## Secao Tecnica

### Estrutura do UserEditDialog

```typescript
interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithPermissions;
  currentUserId: number; // usuario logado, para validar auto-edicao
  onSuccess?: () => void;
}

// Estados internos
const [name, setName] = useState(user.name);
const [email, setEmail] = useState(user.email);
const [role, setRole] = useState(user.role);
const [isActive, setIsActive] = useState(user.is_active);
const [emailError, setEmailError] = useState('');
const [showPasswordReset, setShowPasswordReset] = useState(false);
const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
```

### Endpoint update_user_profile

```typescript
case 'update_user_profile': {
  const { userId, name, email, role, isActive } = data;
  
  // Sincronizar is_active com status (legacy)
  const status = isActive ? 1 : 0;
  
  const rows = await sql.unsafe(
    `UPDATE users 
     SET name = $1, email = $2, role = $3, is_active = $4, status = $5, updated_at = now()
     WHERE id = $6
     RETURNING id, name, email, role, is_active, status, user_id as parent_user_id, created_at`,
    [name, email, role, isActive, status, userId]
  );
  result = rows;
  break;
}
```

