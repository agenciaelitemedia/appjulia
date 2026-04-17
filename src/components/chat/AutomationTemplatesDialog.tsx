import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Sparkles, Loader2, Check } from 'lucide-react';
import { CHAT_AUTOMATION_TEMPLATES, CATEGORY_LABELS, type AutomationTemplate } from '@/lib/chatAutomationTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AutomationTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onCreated: () => void;
}

export function AutomationTemplatesDialog({ open, onOpenChange, clientId, onCreated }: AutomationTemplatesDialogProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<AutomationTemplate['category'] | 'all'>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<AutomationTemplate['category']>();
    CHAT_AUTOMATION_TEMPLATES.forEach(t => cats.add(t.category));
    return Array.from(cats);
  }, []);

  const filtered = useMemo(() => {
    return CHAT_AUTOMATION_TEMPLATES.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [search, activeCategory]);

  const install = async (template: AutomationTemplate) => {
    setInstalling(template.id);
    try {
      const { error } = await supabase.from('chat_automation_rules').insert({
        client_id: clientId,
        ...template.rule,
      });
      if (error) throw error;
      setInstalled(prev => new Set(prev).add(template.id));
      toast.success(`Regra "${template.rule.name}" criada`);
      onCreated();
    } catch (err) {
      toast.error('Erro ao instalar template');
      console.error(err);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Biblioteca de Automações
          </DialogTitle>
          <DialogDescription>
            Regras prontas para ativar em 1 clique. Você pode editar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveCategory('all')}
            >
              Todas
            </Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              Nenhum template encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(template => {
                const isInstalled = installed.has(template.id);
                const isInstalling = installing === template.id;
                return (
                  <div
                    key={template.id}
                    className={cn(
                      'border rounded-lg p-4 transition-all hover:border-primary/40 hover:shadow-sm',
                      isInstalled && 'bg-primary/5 border-primary/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl shrink-0">{template.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm leading-tight">{template.name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            {CATEGORY_LABELS[template.category]}
                          </Badge>
                          {!template.rule.is_active && (
                            <span className="text-[10px] text-muted-foreground">criada inativa</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isInstalled ? 'outline' : 'default'}
                      className="w-full mt-3"
                      disabled={isInstalling || isInstalled}
                      onClick={() => install(template)}
                    >
                      {isInstalling ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Instalando...</>
                      ) : isInstalled ? (
                        <><Check className="h-3.5 w-3.5 mr-1.5" /> Instalada</>
                      ) : (
                        'Usar template'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
