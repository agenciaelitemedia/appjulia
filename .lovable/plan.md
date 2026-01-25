
# Plano: Editar Dados do Cliente e Upload de Foto no Perfil

## Objetivo
Expandir a página de configurações do perfil para permitir:
1. Editar dados do cliente associado ao usuário logado
2. Upload e exibição de foto de perfil (armazenada no campo `photo` da tabela `clients`)

---

## Análise Atual

**Estrutura Existente:**
- Tabela `users` possui campo `client_id` que referencia a tabela `clients`
- Tabela `clients` possui campo `photo` (varchar 200) para armazenar URL da foto
- Bucket de storage `creatives` já existe e está público
- Padrão de upload já implementado em `CreativeUploadDialog.tsx`

**Campos da Tabela `clients` a Editar:**
- `name` (varchar 100)
- `business_name` (varchar 100)
- `email` (varchar 100)
- `phone` (varchar 20)
- `federal_id` (varchar 20) - CPF/CNPJ
- `state` (varchar 2)
- `city` (varchar 50)
- `zip_code` (varchar 20)
- `photo` (varchar 200) - URL da foto de perfil

---

## Implementação

### 1. Criar Bucket para Fotos de Perfil

Criar um novo bucket `avatars` para armazenar as fotos de perfil dos clientes.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);
```

### 2. Atualizar AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

Adicionar `client_id` à interface `User`:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  cod_agent?: number;
  client_id?: number;  // NOVO
  // ... demais campos
}
```

### 3. Atualizar Edge Function para Retornar client_id no Login

**Arquivo:** `supabase/functions/db-query/index.ts`

Modificar a query de login para incluir `client_id`:

```sql
SELECT id, name, email, role, cod_agent, client_id, ...
FROM users WHERE email = $1
```

### 4. Adicionar Ação para Buscar Dados do Cliente

**Arquivo:** `supabase/functions/db-query/index.ts`

Novo case `get_client`:

```typescript
case 'get_client': {
  const { clientId } = data;
  const clients = await sql.unsafe(
    `SELECT id, name, business_name, federal_id, email, phone, 
            country, state, city, zip_code, photo
     FROM clients WHERE id = $1 LIMIT 1`,
    [clientId]
  );
  result = clients;
  break;
}
```

### 5. Adicionar Ação para Atualizar Dados do Cliente

**Arquivo:** `supabase/functions/db-query/index.ts`

Novo case `update_client`:

```typescript
case 'update_client': {
  const { clientId, clientData } = data;
  // Construir UPDATE dinâmico com campos fornecidos
  // Atualizar updated_at
  break;
}
```

### 6. Atualizar Biblioteca externalDb

**Arquivo:** `src/lib/externalDb.ts`

Adicionar métodos:

```typescript
async getClient(clientId: number): Promise<Client | null>
async updateClient(clientId: number, data: Partial<Client>): Promise<Client>
```

### 7. Criar Interface Client

**Arquivo:** `src/types/client.ts` (novo) ou em `externalDb.ts`

```typescript
interface Client {
  id: number;
  name: string;
  business_name: string;
  federal_id: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  zip_code: string;
  photo: string | null;
}
```

### 8. Refatorar ProfileSettingsPage

**Arquivo:** `src/pages/profile/ProfileSettingsPage.tsx`

Layout reorganizado com 3 seções:

```text
+----------------------------------+----------------------------------+
|        FOTO + AVATAR             |        ALTERAR SENHA             |
|   (upload clicando na foto)      |       (formulário atual)         |
+----------------------------------+----------------------------------+
|                    DADOS DO CLIENTE                                 |
|  Nome | Razão Social | CPF/CNPJ | Email | Telefone                  |
|  Estado | Cidade | CEP                                              |
|                            [Salvar Alterações]                      |
+---------------------------------------------------------------------+
```

**Funcionalidades:**
- Carregar dados do cliente via `useEffect` usando `client_id` do usuário
- Upload de foto: clicar no avatar abre seletor de arquivo
- Upload usa Supabase Storage (bucket `avatars`)
- Após upload, atualizar campo `photo` na tabela `clients`
- Formulário com validação básica (campos obrigatórios)
- Botão "Salvar Alterações" para atualizar dados do cliente

### 9. Componente de Upload de Avatar

Funcionalidade inline no ProfileSettingsPage:
- Área clicável sobre o Avatar existente
- Ícone de câmera sobreposto ao hover
- Input file oculto aceita apenas imagens
- Preview antes de salvar
- Progress indicator durante upload

---

## Fluxo de Dados

```text
1. Usuário acessa /perfil
2. Sistema carrega dados do usuário (useAuth)
3. Se user.client_id existe, busca dados do cliente
4. Exibe formulário com dados preenchidos
5. Upload de foto:
   a. Seleciona arquivo
   b. Valida tipo e tamanho
   c. Upload para bucket 'avatars'
   d. Obtém URL pública
   e. Atualiza campo photo na tabela clients
6. Edição de dados:
   a. Usuário modifica campos
   b. Clica em "Salvar"
   c. Sistema envia update_client
   d. Toast de confirmação
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/db-query/index.ts` | Adicionar ações `get_client`, `update_client` e incluir `client_id` no login |
| `src/lib/externalDb.ts` | Adicionar métodos `getClient`, `updateClient` |
| `src/contexts/AuthContext.tsx` | Adicionar `client_id` na interface User |
| `src/pages/profile/ProfileSettingsPage.tsx` | Refatorar com edição de dados e upload de foto |
| (Migration SQL) | Criar bucket `avatars` |

---

## Detalhes Técnicos

### Upload de Foto

Padrão similar ao já usado em `CreativeUploadDialog.tsx`:

```typescript
const uploadAvatar = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `client_${clientId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });
    
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(data.path);
    
  return urlData.publicUrl;
};
```

### Validação de Foto
- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`
- Tamanho máximo: 5MB

### Estados do Formulário
- `clientData`: dados carregados do cliente
- `formData`: dados editados (controlled inputs)
- `isLoading`: carregando dados iniciais
- `isSaving`: salvando alterações
- `isUploadingPhoto`: upload de foto em progresso
- `hasChanges`: detecta se houve alterações para habilitar botão salvar

---

## Tratamento de Erros

- Usuário sem `client_id`: exibir apenas dados do usuário (sem seção de cliente)
- Falha no upload: toast com mensagem de erro
- Falha na atualização: toast com mensagem, manter dados no formulário
- Validação de campos: mensagens inline

---

## Considerações de UX

- Avatar com overlay de câmera no hover
- Skeleton loading enquanto carrega dados do cliente
- Feedback visual durante upload (progress ou spinner)
- Toast de sucesso após salvar
- Confirmação antes de sair se houver alterações não salvas (opcional)
