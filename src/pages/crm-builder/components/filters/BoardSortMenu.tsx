import { ArrowUpDown, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { BoardSortState, DealSortField, SortDirection } from '../../types';

const FIELD_LABELS: Record<DealSortField, string> = {
  stage_entered_at: 'Tempo na etapa',
  created_at: 'Criação do card',
  updated_at: 'Atualização do card',
  due_date: 'Data de entrega',
};

const FIELDS: DealSortField[] = [
  'stage_entered_at',
  'created_at',
  'updated_at',
  'due_date',
];

interface Props {
  value: BoardSortState;
  onChange: (next: BoardSortState) => void;
}

export function BoardSortMenu({ value, onChange }: Props) {
  const activeLabel = FIELD_LABELS[value.field];
  const dirLabel = value.direction === 'desc' ? 'Decrescente' : 'Crescente';

  const select = (field: DealSortField, direction: SortDirection) => {
    onChange({ field, direction });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" title={`Ordenar: ${activeLabel} (${dirLabel})`}>
          <ArrowUpDown className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">
            {activeLabel}
            <span className="ml-1 text-muted-foreground">
              ({value.direction === 'desc' ? '↓' : '↑'})
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Ordenar cards por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FIELDS.map((field, idx) => {
          const isActive = value.field === field;
          return (
            <div key={field}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
                {FIELD_LABELS[field]}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => select(field, 'asc')}
                className={cn(isActive && value.direction === 'asc' && 'bg-accent')}
              >
                <ArrowUp className="h-3.5 w-3.5 mr-2" />
                Crescente
                {isActive && value.direction === 'asc' && (
                  <Check className="h-3.5 w-3.5 ml-auto" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => select(field, 'desc')}
                className={cn(isActive && value.direction === 'desc' && 'bg-accent')}
              >
                <ArrowDown className="h-3.5 w-3.5 mr-2" />
                Decrescente
                {isActive && value.direction === 'desc' && (
                  <Check className="h-3.5 w-3.5 ml-auto" />
                )}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}