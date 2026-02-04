import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Search, ArrowUpDown } from 'lucide-react';
import { CampaignLead } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampanhasTopTableProps {
  data: CampaignLead[];
  isLoading: boolean;
  searchTerm: string;
}

const platformColors: Record<string, string> = {
  facebook: 'bg-blue-500',
  instagram: 'bg-pink-500',
  google: 'bg-blue-400',
  outros: 'bg-gray-500',
};

type SortField = 'total_leads' | 'campaign_title' | 'platform' | 'last_lead';
type SortOrder = 'asc' | 'desc';

export function CampanhasTopTable({ data, isLoading, searchTerm: externalSearch }: CampanhasTopTableProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_leads');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const search = externalSearch || internalSearch;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredData = data
    .filter(campaign => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        campaign.campaign_title?.toLowerCase().includes(searchLower) ||
        campaign.platform?.toLowerCase().includes(searchLower) ||
        campaign.campaign_id?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'total_leads':
          comparison = a.total_leads - b.total_leads;
          break;
        case 'campaign_title':
          comparison = (a.campaign_title || '').localeCompare(b.campaign_title || '');
          break;
        case 'platform':
          comparison = (a.platform || '').localeCompare(b.platform || '');
          break;
        case 'last_lead':
          comparison = new Date(a.last_lead).getTime() - new Date(b.last_lead).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Top Campanhas
            <Badge variant="secondary" className="ml-2">
              {filteredData.length} campanhas
            </Badge>
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha..."
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">
              {search ? 'Nenhuma campanha encontrada' : 'Nenhum dado disponível para o período'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('campaign_title')}
                  >
                    <div className="flex items-center gap-1">
                      Campanha
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('platform')}
                  >
                    <div className="flex items-center gap-1">
                      Plataforma
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('total_leads')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Leads
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('last_lead')}
                  >
                    <div className="flex items-center gap-1">
                      Último Lead
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.slice(0, 20).map((campaign, index) => (
                  <TableRow key={campaign.campaign_id || index} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm line-clamp-2">
                          {campaign.campaign_title || 'Sem título'}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {campaign.campaign_id?.slice(0, 20)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`text-white ${platformColors[campaign.platform?.toLowerCase()] || platformColors.outros}`}
                      >
                        {campaign.platform || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-lg">{campaign.total_leads}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(parseISO(campaign.last_lead), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {filteredData.length > 20 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Mostrando 20 de {filteredData.length} campanhas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
