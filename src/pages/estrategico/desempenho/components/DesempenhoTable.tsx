import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { MessageSquare } from 'lucide-react';
import { JuliaSessao } from '../../types';
import { formatDbDateTime } from '@/lib/dateUtils';

const ITEMS_PER_PAGE = 20;

interface DesempenhoTableProps {
  sessoes: JuliaSessao[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function DesempenhoTable({ sessoes, isLoading, searchTerm = '' }: DesempenhoTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredSessoes = useMemo(() => {
    if (!searchTerm) return sessoes;
    
    const term = searchTerm.toLowerCase();
    return sessoes.filter((s) =>
      s.name?.toLowerCase().includes(term) ||
      s.business_name?.toLowerCase().includes(term) ||
      s.whatsapp?.includes(term) ||
      s.cod_agent?.includes(term)
    );
  }, [sessoes, searchTerm]);

  // Reset page when search term changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredSessoes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSessoes = filteredSessoes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filteredSessoes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma sessão encontrada</p>
      </div>
    );
  }

  const getPerfilBadge = (perfil: string) => {
    const variants: Record<string, { className: string }> = {
      SDR: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
      CLOSER: { className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
    };
    return variants[perfil] || { className: 'bg-gray-100 text-gray-800' };
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return { className: 'bg-gray-100 text-gray-800' };
    
    const variants: Record<string, { className: string }> = {
      CREATED: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
      SIGNED: { className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      PENDING: { className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
    };
    return variants[status] || { className: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Última Msg</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessoes.map((sessao) => (
              <TableRow key={`${sessao.session_id}-${sessao.created_at}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">[{sessao.cod_agent}]</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {sessao.name}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <a
                    href={`https://wa.me/${sessao.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {sessao.whatsapp}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={getPerfilBadge(sessao.perfil_agent).className}>
                    {sessao.perfil_agent}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {sessao.total_msg?.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDbDateTime(sessao.created_at)}
                </TableCell>
                <TableCell className="text-sm">
                  {sessao.max_created_at ? formatDbDateTime(sessao.max_created_at) : '-'}
                </TableCell>
                <TableCell>
                  {sessao.status_document ? (
                    <Badge variant="secondary" className={getStatusBadge(sessao.status_document).className}>
                      {sessao.status_document}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Exibindo {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredSessoes.length)} de {filteredSessoes.length} sessões
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, index, arr) => {
                  const showEllipsisBefore = index > 0 && page - arr[index - 1] > 1;
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsisBefore && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </span>
                  );
                })}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
