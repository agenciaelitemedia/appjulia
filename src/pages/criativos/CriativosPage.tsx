import { useState } from 'react';
import { FolderOpen, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { CriativosFiltersState, CreativeFile } from './types';
import { useCreativeCategories, useMyCreatives, useSharedCreatives } from './hooks/useCriativosData';
import { CriativosHeader } from './components/CriativosHeader';
import { CriativosFilters } from './components/CriativosFilters';
import { CriativosGrid } from './components/CriativosGrid';
import { CreativeUploadDialog } from './components/CreativeUploadDialog';
import { CreativePreviewDialog } from './components/CreativePreviewDialog';

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
  const { data: myCreatives = [], isLoading: loadingMy } = useMyCreatives(filters, user?.id);
  const { data: sharedCreatives = [], isLoading: loadingShared } = useSharedCreatives(filters, user?.id);

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
          <TabsTrigger value="my" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Meus Criativos ({myCreatives.length})
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <Users className="h-4 w-4" />
            Biblioteca ({sharedCreatives.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4">
          <CriativosGrid 
            files={myCreatives}
            isLoading={loadingMy}
            onPreview={setPreviewFile}
            showOwner={false}
            canEdit={true}
          />
        </TabsContent>

        <TabsContent value="library" className="mt-4">
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
