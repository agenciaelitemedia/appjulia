import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, MousePointerClick, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeDefinition } from '../../registry/nodeRegistry';
import { CATEGORY_META } from '../../registry/categories';
import type { FlowCanvasNode, FlowNodeConfig } from '../../types';

interface NodeInspectorProps {
  node: FlowCanvasNode | null;
  onChangeLabel: (nodeId: string, label: string) => void;
  onChangeConfig: (nodeId: string, patch: FlowNodeConfig) => void;
  onRequestDelete: (nodeId: string) => void;
  readOnly: boolean;
}

export function NodeInspector({ node, onChangeLabel, onChangeConfig, onRequestDelete, readOnly }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="hidden w-80 shrink-0 flex-col items-center justify-center gap-3 border-l bg-card p-8 text-center lg:flex">
        <MousePointerClick className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum bloco selecionado</p>
        <p className="text-xs text-muted-foreground">
          Clique em um bloco do quadro para configurar o que ele faz.
        </p>
      </aside>
    );
  }

  const def = getNodeDefinition(node.data.kind);
  if (!def) return null;
  const meta = CATEGORY_META[def.category];
  const Icon = def.icon;
  const config = node.data.config || {};
  const errors = def.validate(config);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-card">
      <div className="flex items-start gap-2.5 border-b px-4 py-3">
        <span className={cn('rounded-md p-1.5', meta.bg, meta.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{def.label}</p>
          <p className="text-[11px] text-muted-foreground">{def.description}</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className={cn('space-y-4 p-4', readOnly && 'pointer-events-none opacity-60')}>
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{errors.join(' · ')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Nome do bloco</Label>
            <Input
              value={node.data.label ?? ''}
              placeholder={def.label}
              onChange={(e) => onChangeLabel(node.id, e.target.value)}
            />
          </div>

          <div className="h-px bg-border" />

          <def.Form config={config} onChange={(patch) => onChangeConfig(node.id, patch)} />
        </div>
      </ScrollArea>

      {!readOnly && (
        <div className="border-t p-3">
          <Button variant="outline" className="w-full text-destructive" onClick={() => onRequestDelete(node.id)}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir bloco
          </Button>
        </div>
      )}
    </aside>
  );
}