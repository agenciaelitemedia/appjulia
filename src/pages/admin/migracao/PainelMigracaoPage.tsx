import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Copy, Check, Database, Code2, ListChecks, Info, Key } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import checklistMd from './content/checklist.md?raw';
import inventarioMd from './content/inventario.md?raw';

const SECRET_NAMES_NOTE =
  'Os nomes dos secrets estão listados no checklist. Os valores só devem ser copiados na interface autenticada do backend (Secrets) — nunca expostos em página, log ou endpoint.';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
}

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL ?? 'não configurado';
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? 'não configurado';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'não configurado';

const STEPS = [
  'Criar o novo projeto de backend e anotar apenas a URL e a chave pública (anon).',
  'Aplicar as migrations versionadas do repositório (supabase/migrations) na ordem cronológica.',
  'Publicar as Edge Functions do repositório (supabase/functions) no novo projeto.',
  'Cadastrar os secrets no novo projeto usando os nomes do checklist — copiando os valores direto da UI autenticada.',
  'Exportar e importar os dados pelo próprio backend (Advanced settings → Export data).',
  'Revisar RLS e políticas das tabelas sinalizadas no inventário.',
  'Atualizar as variáveis do frontend (URL e chave pública) e validar login, chat, CRM e webhooks.',
  'Apagar esta página quando a migração terminar.',
];

export default function PainelMigracaoPage() {
  const { isAdmin } = usePermission();

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>Apenas administradores podem acessar o Painel de Migração.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Painel de Migração</h1>
          <Badge variant="secondary">temporário</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Roteiro seguro para migrar o backend deste projeto: ordem de execução, inventário de tabelas e nomes de
          secrets. Nenhuma chave privada é exibida aqui.
        </p>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Segurança</AlertTitle>
        <AlertDescription>{SECRET_NAMES_NOTE}</AlertDescription>
      </Alert>

      <Tabs defaultValue="ordem">
        <TabsList>
          <TabsTrigger value="ordem">
            <ListChecks className="h-4 w-4 mr-2" />
            Ordem
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <Code2 className="h-4 w-4 mr-2" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="credenciais">
            <Key className="h-4 w-4 mr-2" />
            Credenciais
          </TabsTrigger>
          <TabsTrigger value="tabelas">
            <Database className="h-4 w-4 mr-2" />
            Tabelas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ordem" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Passo a passo</CardTitle>
              <CardDescription>Execute na ordem indicada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 list-decimal pl-5 text-sm">
                {STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <CopyButton value={STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n')} label="Copiar passos" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Checklist de migração</CardTitle>
                <CardDescription>Nomes de secrets, Edge Functions e sequência completa.</CardDescription>
              </div>
              <CopyButton value={checklistMd} label="Copiar" />
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{checklistMd}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credenciais" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais do projeto atual</CardTitle>
              <CardDescription>Somente valores públicos, protegidos por RLS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">URL do projeto</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{PROJECT_URL}</code>
                  <CopyButton value={PROJECT_URL} label="Copiar" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Project ID</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{PROJECT_ID}</code>
                  <CopyButton value={PROJECT_ID} label="Copiar" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Chave pública (anon)</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{PUBLISHABLE_KEY}</code>
                  <CopyButton value={PUBLISHABLE_KEY} label="Copiar" />
                </div>
              </div>
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Service role key não é exibida aqui</AlertTitle>
                <AlertDescription>
                  A service role key ignora RLS e dá controle total do banco, por isso nunca é enviada ao navegador.
                  Ela também não é recuperável no painel do backend gerenciado. Para o projeto de destino, gere uma nova
                  chave no próprio provedor e cadastre-a apenas como secret do servidor.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tabelas" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Inventário de tabelas</CardTitle>
                <CardDescription>Colunas, RLS e políticas — com itens sinalizados para revisão.</CardDescription>
              </div>
              <CopyButton value={inventarioMd} label="Copiar" />
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{inventarioMd}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
