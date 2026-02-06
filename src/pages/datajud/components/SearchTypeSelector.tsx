import { Search, FileText, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchType } from '../types';
import { getSearchTypeLabel } from '../utils';

interface SearchTypeSelectorProps {
  value: SearchType;
  onChange: (type: SearchType) => void;
  disabled?: boolean;
}

const searchTypes: { type: SearchType; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { type: 'process_number', icon: FileText, description: 'Ex: 0001234-56.2024.8.26.0100' },
  { type: 'document', icon: Building2, description: 'CPF ou CNPJ da parte' },
  { type: 'lawyer', icon: User, description: 'Ex: SP 123456' },
];

export function SearchTypeSelector({ value, onChange, disabled }: SearchTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {searchTypes.map(({ type, icon: Icon, description }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
            value === type
              ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
              : 'bg-card hover:bg-accent text-card-foreground border-border hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Icon className="h-4 w-4" />
          <div className="text-left">
            <div className="text-sm font-medium">{getSearchTypeLabel(type)}</div>
            <div className={cn(
              'text-xs',
              value === type ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
