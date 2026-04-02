import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Eye, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function ContratoTemplatePage() {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('julia_contract_template')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setTemplateId(data.id);
        setBody(data.body_markdown);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!templateId) return;
    setSaving(true);
    const { error } = await supabase
      .from('julia_contract_template')
      .update({ body_markdown: body, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Contrato salvo com sucesso');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Template do Contrato</h1>
          <p className="text-muted-foreground">
            Edite o contrato em Markdown. Use placeholders: {'{{customer_name}}'}, {'{{customer_document}}'}, {'{{customer_email}}'}, {'{{customer_whatsapp}}'}, {'{{customer_address}}'}, {'{{plan_name}}'}, {'{{plan_price}}'}, {'{{billing_period}}'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          >
            {mode === 'edit' ? <Eye className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
            {mode === 'edit' ? 'Preview' : 'Editar'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mode === 'edit' ? 'Editor Markdown' : 'Pré-visualização'}</CardTitle>
          <CardDescription>
            {mode === 'edit'
              ? 'Escreva o contrato usando Markdown. Os placeholders serão substituídos pelos dados do cliente.'
              : 'Assim ficará o contrato para o cliente (placeholders não substituídos).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'edit' ? (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
              placeholder="# Contrato..."
            />
          ) : (
            <div className="prose prose-sm max-w-none border rounded-lg p-6 bg-gray-50/50 min-h-[500px]">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
