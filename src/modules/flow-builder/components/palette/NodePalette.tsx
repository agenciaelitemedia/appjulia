import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { NODE_LIST } from '../../registry/nodeRegistry';
import { CATEGORY_META, CATEGORY_ORDER } from '../../registry/categories';
import type { FlowNodeKind } from '../../types';

interface NodePaletteProps {
  onAdd: (kind: FlowNodeKind) => void;
  disabled?: boolean;
}

export function NodePalette({ onAdd, disabled }: NodePaletteProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Blocos</h2>
        <p className="text-[11px] text-muted-foreground">Arraste para o quadro ou clique para adicionar.</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-5 p-3">
          {CATEGORY_ORDER.map((category) => {
            const items = NODE_LIST.filter((n) => n.category === category);
            if (!items.length) return null;
            const meta = CATEGORY_META[category];
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
                {items.map((def) => {
                  const Icon = def.icon;
                  return (
                    <button
                      key={def.kind}
                      type="button"
                      draggable={!disabled}
                      disabled={disabled}
                      onDragStart={(e) => e.dataTransfer.setData('application/flow-node', def.kind)}
                      onClick={() => onAdd(def.kind)}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg border bg-background p-2.5 text-left transition-colors',
                        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:border-ring hover:bg-accent',
                      )}
                    >
                      <span className={cn('rounded-md p-1.5', meta.bg, meta.text)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium leading-tight">{def.label}</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">{def.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}