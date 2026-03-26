import { FileText, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenerateScriptTab } from './components/GenerateScriptTab';
import { LegalCasesTab } from './components/LegalCasesTab';
import { PromptConfigTab } from './components/PromptConfigTab';
import { TemplatesTab } from './components/TemplatesTab';

export default function PromptGeneratorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gerador de Prompt</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie roteiros de qualificação jurídica com IA</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="generate">Gerar Roteiros</TabsTrigger>
          <TabsTrigger value="cases">Casos Jurídicos</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="prompts" disabled>
            <span className="flex items-center gap-1">Prompts <Clock className="h-3 w-3" /></span>
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateScriptTab />
        </TabsContent>

        <TabsContent value="cases">
          <LegalCasesTab />
        </TabsContent>

        <TabsContent value="config">
          <PromptConfigTab />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
