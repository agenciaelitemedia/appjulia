import { FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchType } from '../types';
import { getSearchTypeLabel } from '../utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SearchTypeSelectorProps {
  value: SearchType;
  onChange: (type: SearchType) => void;
  disabled?: boolean;
}

export function SearchTypeSelector({ value, onChange, disabled }: SearchTypeSelectorProps) {
  return (
    <div className="space-y-3">
      {/* Only process number search is available */}
      <button
        type="button"
        onClick={() => onChange('process_number')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
          value === 'process_number'
            ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
            : 'bg-card hover:bg-accent text-card-foreground border-border hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <FileText className="h-4 w-4" />
        <div className="text-left">
          <div className="text-sm font-medium">{getSearchTypeLabel('process_number')}</div>
          <div className={cn(
            'text-xs',
            value === 'process_number' ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            Ex: 0001234-56.2024.8.26.0100
          </div>
        </div>
      </button>

      {/* LGPD Notice */}
      <Alert variant="default" className="border-warning/30 bg-warning/10">
        <AlertCircle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong>Limitação LGPD:</strong> A API pública do DataJud não permite busca por CPF/CNPJ ou OAB 
          devido à proteção de dados pessoais. Apenas busca por número do processo é suportada.
        </AlertDescription>
      </Alert>
    </div>
  );
}
