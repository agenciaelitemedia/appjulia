import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, FolderKanban, Sparkles } from 'lucide-react';
import { HelpPostsTab } from './components/HelpPostsTab';
import { HelpCategoriesTab } from './components/HelpCategoriesTab';
import { HelpFeaturedTab } from './components/HelpFeaturedTab';

export default function HelpStudioPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => localStorage.getItem('help-studio-tab') || 'posts');

  const changeTab = (v: string) => {
    setTab(v);
    localStorage.setItem('help-studio-tab', v);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/ajuda')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Studio da Central de Ajuda</h1>
          <p className="text-muted-foreground text-sm">Gerencie categorias, posts e destaques do conteúdo de ajuda</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="posts"><FileText className="h-4 w-4 mr-1" /> Posts</TabsTrigger>
          <TabsTrigger value="categorias"><FolderKanban className="h-4 w-4 mr-1" /> Categorias</TabsTrigger>
          <TabsTrigger value="destaques"><Sparkles className="h-4 w-4 mr-1" /> Destaques</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="mt-4"><HelpPostsTab /></TabsContent>
        <TabsContent value="categorias" className="mt-4"><HelpCategoriesTab /></TabsContent>
        <TabsContent value="destaques" className="mt-4"><HelpFeaturedTab /></TabsContent>
      </Tabs>
    </div>
  );
}