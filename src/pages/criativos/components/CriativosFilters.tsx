import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreativeCategory, CriativosFiltersState } from '../types';

interface CriativosFiltersProps {
  filters: CriativosFiltersState;
  onFiltersChange: (filters: CriativosFiltersState) => void;
  categories: CreativeCategory[];
}

export function CriativosFilters({ filters, onFiltersChange, categories }: CriativosFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-card border border-border rounded-xl shadow-sm">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, descrição..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Categoria */}
      <Select 
        value={filters.categoryId?.toString() || 'all'}
        onValueChange={(v) => onFiltersChange({ 
          ...filters, 
          categoryId: v === 'all' ? null : Number(v) 
        })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Categorias</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id.toString()}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tipo */}
      <Select 
        value={filters.typeFile}
        onValueChange={(v) => onFiltersChange({ 
          ...filters, 
          typeFile: v as 'all' | 'image' | 'video' 
        })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Tipos</SelectItem>
          <SelectItem value="image">Imagens</SelectItem>
          <SelectItem value="video">Vídeos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
