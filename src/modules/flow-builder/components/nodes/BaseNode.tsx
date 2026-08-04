import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Copy, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getNodeDefinition } from '../../registry/nodeRegistry';
import { CATEGORY_META } from '../../registry/categories';
import type { FlowNodeData } from '../../types';

export interface FlowNodeCallbacks {
  onRequestDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  readOnly: boolean;
}

/** Callbacks entregues via nodes[].data não são serializáveis; usamos um registry leve. */
let callbacks: FlowNodeCallbacks = {
  onRequestDelete: () => {},
  onDuplicate: () => {},
  readOnly: false,
};
export function setNodeCallbacks(next: FlowNodeCallbacks) {
  callbacks = next;
}

export const BaseNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as FlowNodeData;
  const def = getNodeDefinition(nodeData.kind);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!def) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-card px-4 py-3 text-xs text-destructive">
        Nó desconhecido: {String(nodeData.kind)}
      </div>
    );
  }

  const meta = CATEGORY_META[def.category];
  const Icon = def.icon;
  const errors = def.validate(nodeData.config || {});
  const invalid = errors.length > 0;
  const outputs = def.outputs;

  return (
    <div
      className={cn(
        'group relative w-[264px] rounded-xl border bg-card shadow-sm transition-all',
        selected ? 'ring-2 ring-ring' : 'hover:shadow-md',
        invalid ? 'border-destructive/60' : meta.border,
      )}
    >
      {def.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ top: '50%' }}
          className="!left-[-7px] !h-3 !w-3 !-translate-y-1/2 !rounded-full !border-2 !border-background !bg-flow-edge"
        />
      )}

      <div className={cn('flex items-start gap-2.5 rounded-t-xl px-3 py-2.5', meta.bg)}>
        <span className={cn('mt-0.5 rounded-md bg-card p-1.5', meta.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {nodeData.label || def.label}
          </p>
          <p className={cn('text-[11px] font-medium', meta.text)}>{meta.label}</p>
        </div>
        <div className="flex items-center gap-1">
          {invalid && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>{errors.join(' · ')}</TooltipContent>
            </Tooltip>
          )}
          {!callbacks.readOnly && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn('h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100', menuOpen && 'opacity-100')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => callbacks.onDuplicate(id)}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => callbacks.onRequestDelete(id)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs leading-snug text-muted-foreground">{def.summary(nodeData.config || {})}</p>
      </div>

      {outputs.length === 1 && (
        <Handle
          id={outputs[0].id}
          type="source"
          position={Position.Right}
          style={{ top: '50%' }}
          className="!right-[-7px] !h-3 !w-3 !-translate-y-1/2 !rounded-full !border-2 !border-background !bg-flow-edge"
        />
      )}

      {outputs.length > 1 && (
        <div className="border-t">
          {outputs.map((out, index) => (
            <div key={out.id} className="relative flex items-center justify-end px-3 py-1.5 text-[11px] text-muted-foreground">
              {out.label}
              <Handle
                id={out.id}
                type="source"
                position={Position.Right}
                style={{ top: '50%' }}
                className="!right-[-7px] !h-3 !w-3 !-translate-y-1/2 !rounded-full !border-2 !border-background !bg-flow-edge"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

BaseNode.displayName = 'FlowBaseNode';