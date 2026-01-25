

# Plano de Implementacao: Pagina de Criativos (Biblioteca de Midias)

## Visao Geral

Este plano cria uma pagina completa de biblioteca de criativos (videos e imagens) com duas abas:
- **Meus Criativos**: Arquivos do proprio usuario
- **Biblioteca**: Arquivos compartilhados por outros usuarios

## Arquitetura da Solucao

```text
+------------------------------------------------------------------+
|                      CRIATIVOS PAGE                               |
+------------------------------------------------------------------+
|  [Header: Criativos + Botao Upload]                              |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |  FILTROS                                                     | |
|  |  [Busca] [Categoria] [Tipo: Todos/Imagem/Video]              | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  +--------------------+ +--------------------+                    |
|  | Meus Criativos     | | Biblioteca         |                    |
|  +--------------------+ +--------------------+                    |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |    GRADE DE MIDIAS (Responsiva)                              | |
|  |  +--------+ +--------+ +--------+ +--------+                 | |
|  |  | Thumb  | | Thumb  | | Thumb  | | Thumb  |                 | |
|  |  | Titulo | | Titulo | | Titulo | | Titulo |                 | |
|  |  | Cat.   | | Cat.   | | Cat.   | | Cat.   |                 | |
|  |  +--------+ +--------+ +--------+ +--------+                 | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

## Parte 1: Ajustar Menu (Sidebar)

### 1.1 Simplificar Item de Menu

**Arquivo:** `src/components/layout/Sidebar.tsx`

Alterar o item "Criativos" de submenu para link direto:

**De:**
```typescript
{
  label: 'Criativos',
  icon: Image,
  children: [
    { label: 'Cadastro', href: '/criativos/cadastro' },
    { label: 'Categorias', href: '/criativos/categorias' },
  ],
},
```

**Para:**
```typescript
{ label: 'Criativos', icon: Image, href: '/criativos' },
```

---

## Parte 2: Estrutura de Arquivos

Criar a seguinte estrutura:

```
src/pages/criativos/
  ├── CriativosPage.tsx           # Pagina principal
  ├── components/
  │   ├── CriativosHeader.tsx     # Header com titulo e botao upload
  │   ├── CriativosFilters.tsx    # Filtros de busca/categoria/tipo
  │   ├── CriativosGrid.tsx       # Grade de miniaturas
  │   ├── CreativeCard.tsx        # Card individual de midia
  │   ├── CreativeUploadDialog.tsx # Dialog de upload
  │   ├── CreativePreviewDialog.tsx # Dialog de visualizacao
  │   └── CreativeEditDialog.tsx  # Dialog de edicao
  ├── hooks/
  │   └── useCriativosData.ts     # Hooks de dados
  └── types.ts                    # Tipos TypeScript
```

---

## Parte 3: Tipos TypeScript

**Arquivo:** `src/pages/criativos/types.ts`

```typescript
export interface CreativeCategory {
  id: number;
  name: string;
  created_at: string;
  update_at: string;
}

export interface CreativeFile {
  id: number;
  creative_category_id: number | null;
  user_id: number;
  type_file: 'image' | 'video';
  name: string;
  title: string;
  description: string | null;
  shared: boolean;
  created_at: string;
  update_at: string;
  // Campos virtuais para join
  category_name?: string;
  user_name?: string;
}

export interface CriativosFiltersState {
  search: string;
  categoryId: number | null;
  typeFile: 'all' | 'image' | 'video';
}

export interface UploadFormData {
  title: string;
  description: string;
  categoryId: number | null;
  shared: boolean;
  file: File | null;
}
```

---

## Parte 4: Hooks de Dados

**Arquivo:** `src/pages/criativos/hooks/useCriativosData.ts`

### 4.1 Hook para Categorias

```typescript
export function useCreativeCategories() {
  return useQuery({
    queryKey: ['creative-categories'],
    queryFn: async () => {
      return externalDb.raw<CreativeCategory>({
        query: `
          SELECT id, name, created_at, update_at
          FROM creative_category
          ORDER BY name ASC
        `,
      });
    },
  });
}
```

### 4.2 Hook para Meus Criativos

```typescript
export function useMyCreatives(filters: CriativosFiltersState, userId: number) {
  return useQuery({
    queryKey: ['my-creatives', filters, userId],
    queryFn: async () => {
      let whereConditions = ['f.user_id = $1'];
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters.typeFile !== 'all') {
        whereConditions.push(`f.type_file = $${paramIndex}`);
        params.push(filters.typeFile);
        paramIndex++;
      }

      if (filters.categoryId) {
        whereConditions.push(`f.creative_category_id = $${paramIndex}`);
        params.push(filters.categoryId);
        paramIndex++;
      }

      if (filters.search) {
        whereConditions.push(`(
          f.title ILIKE $${paramIndex} 
          OR f.description ILIKE $${paramIndex}
          OR f.name ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      return externalDb.raw<CreativeFile>({
        query: `
          SELECT 
            f.id, f.creative_category_id, f.user_id, f.type_file,
            f.name, f.title, f.description, f.shared, 
            f.created_at, f.update_at,
            c.name as category_name
          FROM creative_files f
          LEFT JOIN creative_category c ON f.creative_category_id = c.id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY f.created_at DESC
        `,
        params,
      });
    },
    enabled: !!userId,
  });
}
```

### 4.3 Hook para Biblioteca Compartilhada

```typescript
export function useSharedCreatives(filters: CriativosFiltersState, userId: number) {
  return useQuery({
    queryKey: ['shared-creatives', filters, userId],
    queryFn: async () => {
      let whereConditions = ['f.shared = true', 'f.user_id != $1'];
      const params: any[] = [userId];
      let paramIndex = 2;

      // ... mesma logica de filtros

      return externalDb.raw<CreativeFile>({
        query: `
          SELECT 
            f.*, c.name as category_name, u.name as user_name
          FROM creative_files f
          LEFT JOIN creative_category c ON f.creative_category_id = c.id
          LEFT JOIN users u ON f.user_id = u.id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY f.created_at DESC
        `,
        params,
      });
    },
    enabled: !!userId,
  });
}
```

### 4.4 Mutations para CRUD

```typescript
export function useCreateCreative() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<CreativeFile, 'id' | 'created_at' | 'update_at'>) => {
      return externalDb.insert({
        table: 'creative_files',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-creatives'] });
      queryClient.invalidateQueries({ queryKey: ['shared-creatives'] });
    },
  });
}

export function useUpdateCreative() {
  // Similar pattern para update
}

export function useDeleteCreative() {
  // Similar pattern para delete
}
```

---

## Parte 5: Componentes

### 5.1 Pagina Principal

**Arquivo:** `src/pages/criativos/CriativosPage.tsx`

```typescript
export default function CriativosPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'library'>('my');
  const [filters, setFilters] = useState<CriativosFiltersState>({
    search: '',
    categoryId: null,
    typeFile: 'all',
  });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<CreativeFile | null>(null);

  const { data: categories = [] } = useCreativeCategories();
  const { data: myCreatives = [], isLoading: loadingMy } = useMyCreatives(filters, user?.id!);
  const { data: sharedCreatives = [], isLoading: loadingShared } = useSharedCreatives(filters, user?.id!);

  const currentData = activeTab === 'my' ? myCreatives : sharedCreatives;
  const isLoading = activeTab === 'my' ? loadingMy : loadingShared;

  return (
    <div className="space-y-6">
      <CriativosHeader onUpload={() => setUploadOpen(true)} />

      <CriativosFilters 
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'library')}>
        <TabsList>
          <TabsTrigger value="my">
            <FolderOpen className="h-4 w-4 mr-2" />
            Meus Criativos ({myCreatives.length})
          </TabsTrigger>
          <TabsTrigger value="library">
            <Users className="h-4 w-4 mr-2" />
            Biblioteca ({sharedCreatives.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my">
          <CriativosGrid 
            files={myCreatives}
            isLoading={loadingMy}
            onPreview={setPreviewFile}
            showOwner={false}
            canEdit={true}
          />
        </TabsContent>

        <TabsContent value="library">
          <CriativosGrid 
            files={sharedCreatives}
            isLoading={loadingShared}
            onPreview={setPreviewFile}
            showOwner={true}
            canEdit={false}
          />
        </TabsContent>
      </Tabs>

      <CreativeUploadDialog 
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        categories={categories}
      />

      <CreativePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </div>
  );
}
```

### 5.2 Header

**Arquivo:** `src/pages/criativos/components/CriativosHeader.tsx`

```typescript
export function CriativosHeader({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Criativos</h1>
        <p className="text-muted-foreground">
          Biblioteca de videos e imagens para suas campanhas
        </p>
      </div>

      <Button onClick={onUpload} className="gap-2">
        <Upload className="h-4 w-4" />
        Novo Criativo
      </Button>
    </div>
  );
}
```

### 5.3 Filtros

**Arquivo:** `src/pages/criativos/components/CriativosFilters.tsx`

```typescript
export function CriativosFilters({ filters, onFiltersChange, categories }) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-card border rounded-xl">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por titulo, descricao..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Categoria */}
      <Select 
        value={filters.categoryId?.toString() || 'all'}
        onValueChange={(v) => onFiltersChange({ 
          ...filters, 
          categoryId: v === 'all' ? null : Number(v) 
        })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Categorias</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id.toString()}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tipo */}
      <Select 
        value={filters.typeFile}
        onValueChange={(v) => onFiltersChange({ 
          ...filters, 
          typeFile: v as 'all' | 'image' | 'video' 
        })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Tipos</SelectItem>
          <SelectItem value="image">Imagens</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

### 5.4 Grade de Criativos

**Arquivo:** `src/pages/criativos/components/CriativosGrid.tsx`

```typescript
export function CriativosGrid({ 
  files, 
  isLoading, 
  onPreview, 
  showOwner,
  canEdit 
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum criativo encontrado</h3>
        <p className="text-muted-foreground">
          Ajuste os filtros ou adicione novos criativos
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {files.map(file => (
        <CreativeCard 
          key={file.id}
          file={file}
          onPreview={() => onPreview(file)}
          showOwner={showOwner}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
```

### 5.5 Card Individual

**Arquivo:** `src/pages/criativos/components/CreativeCard.tsx`

```typescript
export function CreativeCard({ file, onPreview, showOwner, canEdit }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteMutation = useDeleteCreative();

  // Placeholder para thumbnail - sera gerado/armazenado
  const thumbnailUrl = file.type_file === 'video' 
    ? '/placeholder-video.svg' 
    : `/uploads/${file.name}`;

  return (
    <Card className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div 
        className="aspect-square relative bg-muted"
        onClick={onPreview}
      >
        {file.type_file === 'video' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="h-12 w-12 text-muted-foreground" />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              VIDEO
            </div>
          </div>
        ) : (
          <img 
            src={thumbnailUrl}
            alt={file.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
          />
        )}

        {/* Overlay com acoes */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="icon" variant="secondary">
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button 
                size="icon" 
                variant="secondary"
                onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="destructive"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (confirm('Excluir este criativo?')) {
                    deleteMutation.mutate(file.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <CardContent className="p-3">
        <h4 className="font-medium text-sm truncate">{file.title}</h4>
        <div className="flex items-center gap-2 mt-1">
          {file.category_name && (
            <Badge variant="secondary" className="text-xs">
              {file.category_name}
            </Badge>
          )}
          {file.shared && (
            <Badge variant="outline" className="text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Compartilhado
            </Badge>
          )}
        </div>
        {showOwner && file.user_name && (
          <p className="text-xs text-muted-foreground mt-1">
            Por: {file.user_name}
          </p>
        )}
      </CardContent>

      {canEdit && (
        <CreativeEditDialog 
          file={file}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </Card>
  );
}
```

### 5.6 Dialog de Upload

**Arquivo:** `src/pages/criativos/components/CreativeUploadDialog.tsx`

```typescript
export function CreativeUploadDialog({ open, onOpenChange, categories }) {
  const { user } = useAuth();
  const createMutation = useCreateCreative();
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    categoryId: null,
    shared: false,
    file: null,
  });
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file, title: file.name.split('.')[0] });
      
      // Gerar preview
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.file || !user) return;

    // Determinar tipo
    const typeFile = formData.file.type.startsWith('video/') ? 'video' : 'image';

    await createMutation.mutateAsync({
      user_id: user.id,
      type_file: typeFile,
      name: formData.file.name,
      title: formData.title,
      description: formData.description,
      creative_category_id: formData.categoryId,
      shared: formData.shared,
    });

    onOpenChange(false);
    // Reset form
    setFormData({ title: '', description: '', categoryId: null, shared: false, file: null });
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Criativo</DialogTitle>
          <DialogDescription>
            Adicione uma imagem ou video a sua biblioteca
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            {preview ? (
              <div className="relative">
                {formData.file?.type.startsWith('video/') ? (
                  <video src={preview} className="max-h-48 mx-auto rounded" controls />
                ) : (
                  <img src={preview} className="max-h-48 mx-auto rounded" alt="Preview" />
                )}
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2"
                  onClick={() => { setPreview(null); setFormData({ ...formData, file: null }); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Clique para selecionar</p>
                <p className="text-xs text-muted-foreground">ou arraste e solte aqui</p>
              </label>
            )}
          </div>

          {/* Titulo */}
          <div className="space-y-2">
            <Label>Titulo *</Label>
            <Input 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nome do criativo"
            />
          </div>

          {/* Descricao */}
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descricao opcional..."
              rows={3}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select 
              value={formData.categoryId?.toString() || ''}
              onValueChange={(v) => setFormData({ 
                ...formData, 
                categoryId: v ? Number(v) : null 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Compartilhar */}
          <div className="flex items-center gap-2">
            <Checkbox 
              id="shared"
              checked={formData.shared}
              onCheckedChange={(checked) => setFormData({ 
                ...formData, 
                shared: !!checked 
              })}
            />
            <Label htmlFor="shared" className="cursor-pointer">
              Compartilhar na Biblioteca (outros usuarios poderao ver)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.file || !formData.title || createMutation.isPending}
          >
            {createMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.7 Dialog de Preview

**Arquivo:** `src/pages/criativos/components/CreativePreviewDialog.tsx`

Dialog modal para visualizar imagem/video em tamanho maior com informacoes completas.

---

## Parte 6: Rotas

**Arquivo:** `src/App.tsx`

Adicionar rota para a pagina:

```typescript
import CriativosPage from "./pages/criativos/CriativosPage";

// Dentro de Routes:
<Route path="/criativos" element={<CriativosPage />} />
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/layout/Sidebar.tsx` | Modificar | Simplificar menu de Criativos para link unico |
| `src/App.tsx` | Modificar | Adicionar rota /criativos |
| `src/pages/criativos/types.ts` | Criar | Tipos TypeScript |
| `src/pages/criativos/hooks/useCriativosData.ts` | Criar | Hooks de dados |
| `src/pages/criativos/CriativosPage.tsx` | Criar | Pagina principal |
| `src/pages/criativos/components/CriativosHeader.tsx` | Criar | Header |
| `src/pages/criativos/components/CriativosFilters.tsx` | Criar | Filtros |
| `src/pages/criativos/components/CriativosGrid.tsx` | Criar | Grade de miniaturas |
| `src/pages/criativos/components/CreativeCard.tsx` | Criar | Card individual |
| `src/pages/criativos/components/CreativeUploadDialog.tsx` | Criar | Dialog de upload |
| `src/pages/criativos/components/CreativePreviewDialog.tsx` | Criar | Dialog de preview |
| `src/pages/criativos/components/CreativeEditDialog.tsx` | Criar | Dialog de edicao |

---

## Funcionalidades por Aba

### Aba "Meus Criativos"
- Exibe apenas arquivos do usuario logado (`user_id = current_user`)
- Permite: visualizar, editar, excluir, compartilhar/descompartilhar
- Botao de upload disponivel

### Aba "Biblioteca"
- Exibe arquivos de outros usuarios marcados como `shared = true`
- Mostra nome do autor
- Permite apenas: visualizar
- Nao pode editar/excluir arquivos de outros

---

## Fluxo de Upload

```text
1. Usuario clica "Novo Criativo"
          |
          v
2. Dialog abre com dropzone
          |
          v
3. Usuario seleciona arquivo (imagem ou video)
          |
          v
4. Preview e gerado automaticamente
          |
          v
5. Usuario preenche: titulo, descricao, categoria, compartilhar
          |
          v
6. Ao salvar: 
   - Arquivo e enviado para storage (a definir)
   - Registro criado em creative_files
          |
          v
7. Lista atualiza automaticamente
```

---

## Consideracoes sobre Storage de Arquivos

A tabela `creative_files` armazena apenas metadados. Os arquivos fisicos precisam ser armazenados em algum lugar. Opcoes:

1. **Servidor externo existente** - Se ja existe um servidor de arquivos
2. **Lovable Cloud Storage** - Supabase Storage (buckets)
3. **URL externa** - Armazenar apenas URL do arquivo hospedado em outro lugar

Para a implementacao inicial, o campo `name` pode armazenar a URL ou caminho do arquivo, e a integracao com storage sera feita conforme necessidade.

---

## Busca e Filtragem

A interface permite busca eficiente por:
- **Texto livre**: busca em titulo, descricao e nome do arquivo (ILIKE)
- **Categoria**: filtro exato por creative_category_id
- **Tipo**: filtro por type_file (image/video)

Os filtros sao combinados (AND) para resultados precisos.

---

## Design Visual

- Grade responsiva com aspectos quadrados (miniaturas)
- Hover effects para revelar acoes
- Badges para categoria e status de compartilhamento
- Dialogs modais para upload e preview
- Skeleton loading durante carregamento
- Estado vazio com ilustracao e mensagem

