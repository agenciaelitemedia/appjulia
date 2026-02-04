import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { CampaignDetailCard } from './CampaignDetailCard';
import { useCampanhasDetails } from '../hooks/useCampanhasDetails';
import { useCampaignsFunnelByGroup } from '../hooks/useCampaignsFunnelByGroup';
import { CampanhasFiltersState, CampaignDetailGrouped, CampaignFunnelData } from '../types';

interface CampanhasListTabProps {
  filters: CampanhasFiltersState;
}

type SortOption = 'leads' | 'recent' | 'oldest' | 'platform';

const ITEMS_PER_PAGE = 20;

export function CampanhasListTab({ filters }: CampanhasListTabProps) {
  const [localSearch, setLocalSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('leads');
  const [isGridView, setIsGridView] = useState(true);
  const [page, setPage] = useState(1);

  const { data: campaigns = [], isLoading } = useCampanhasDetails(filters);
  const { data: funnelData = [], isLoading: funnelLoading } = useCampaignsFunnelByGroup(filters);

  // Create Map for O(1) lookup of funnel data by group_key
  const funnelMap = useMemo(() => {
    const map = new Map<string, CampaignFunnelData>();
    funnelData.forEach(f => map.set(f.group_key, f));
    return map;
  }, [funnelData]);

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Apply local search filter
    if (localSearch.trim()) {
      const searchLower = localSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.campaign_title?.toLowerCase().includes(searchLower) ||
          c.campaign_body?.toLowerCase().includes(searchLower) ||
          c.last_greeting_message?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'leads':
        result.sort((a, b) => b.total_leads - a.total_leads);
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.last_lead).getTime() - new Date(a.last_lead).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.first_lead).getTime() - new Date(b.first_lead).getTime());
        break;
      case 'platform':
        result.sort((a, b) => (a.platforms?.[0] || '').localeCompare(b.platforms?.[0] || ''));
        break;
    }

    return result;
  }, [campaigns, localSearch, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE);
  const paginatedCampaigns = filteredCampaigns.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useMemo(() => {
    setPage(1);
  }, [localSearch, sortBy, filters]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, corpo ou frase..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-48">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leads">Mais leads</SelectItem>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="platform">Plataforma</SelectItem>
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex gap-1">
          <Toggle
            pressed={isGridView}
            onPressedChange={() => setIsGridView(true)}
            aria-label="Grid view"
            size="sm"
          >
            <LayoutGrid className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={!isGridView}
            onPressedChange={() => setIsGridView(false)}
            aria-label="List view"
            size="sm"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredCampaigns.length} campanha{filteredCampaigns.length !== 1 ? 's' : ''} encontrada{filteredCampaigns.length !== 1 ? 's' : ''}
      </p>

      {/* Grid/List */}
      {paginatedCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
          <p className="text-sm">Tente ajustar os filtros ou termo de busca</p>
        </div>
      ) : (
        <div
          className={
            isGridView
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-4'
          }
        >
          {paginatedCampaigns.map((campaign, index) => (
            <CampaignDetailCard
              key={`${campaign.campaign_id}-${index}`}
              campaign={campaign}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
