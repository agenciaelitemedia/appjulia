import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MessageCircle, 
  MoreHorizontal, 
  Pause, 
  Play, 
  Trash2, 
  Search, 
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { FollowupQueueItemEnriched, DERIVED_STATUS_CONFIG } from '../../types';
import { formatDbDateTime } from '@/lib/dateUtils';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';

const ITEMS_PER_PAGE = 20;

type SortField = 'session_id' | 'name_client' | 'step_number' | 'derived_status' | 'send_date';
type SortDirection = 'asc' | 'desc';

interface FollowupQueueProps {
  items: FollowupQueueItemEnriched[];
  isLoading?: boolean;
  onUpdateState: (id: number, state: string) => void;
  onDelete: (id: number) => void;
  isUpdating?: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

function formatWhatsAppNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const firstPart = digits.slice(4, 9);
    const secondPart = digits.slice(9);
    return `+55 (${ddd}) ${firstPart}-${secondPart}`;
  }
  return number;
}

// Step badge component showing current/total
function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Badge variant="default" className="text-xs px-2 min-w-[24px] justify-center">
        {current}
      </Badge>
      <span className="text-muted-foreground text-xs">/</span>
      <Badge variant="outline" className="text-xs px-2 min-w-[24px] justify-center">
        {total}
      </Badge>
    </div>
  );
}

// Derived status badge component
function DerivedStatusBadge({ status }: { status: 'sent' | 'waiting' | 'stopped' }) {
  const config = DERIVED_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Sortable header component
function SortableHeader({ 
  field, 
  label, 
  currentField, 
  direction, 
  onSort,
  className = '',
}: { 
  field: SortField; 
  label: string; 
  currentField: SortField | null; 
  direction: SortDirection; 
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  
  return (
    <TableHead 
      className={`cursor-pointer select-none hover:bg-muted/50 ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}

export function FollowupQueue({
  items,
  isLoading,
  onUpdateState,
  onDelete,
  isUpdating,
  searchTerm,
  onSearchChange,
}: FollowupQueueProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FollowupQueueItemEnriched | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Reset page when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection]);

  // Sort items (items are already filtered from parent)
  const sortedItems = useMemo(() => {
    if (!sortField) return items;
    
    return [...items].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'session_id':
          comparison = (a.session_id || '').localeCompare(b.session_id || '');
          break;
        case 'name_client':
          comparison = (a.name_client || '').localeCompare(b.name_client || '');
          break;
        case 'step_number':
          comparison = a.step_number - b.step_number;
          break;
        case 'derived_status':
          const statusOrder = { sent: 3, waiting: 2, stopped: 1 };
          comparison = statusOrder[a.derived_status] - statusOrder[b.derived_status];
          break;
        case 'send_date':
          comparison = new Date(a.send_date).getTime() - new Date(b.send_date).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleOpenMessages = (item: FollowupQueueItemEnriched) => {
    setSelectedItem(item);
    setMessagesOpen(true);
  };

  const handleTogglePause = (item: FollowupQueueItemEnriched) => {
    const newState = item.state === 'STOP' ? 'QUEUE' : 'STOP';
    onUpdateState(item.id, newState);
  };

  const handleDeleteClick = (id: number) => {
    setSelectedItemId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedItemId) {
      onDelete(selectedItemId);
    }
    setDeleteDialogOpen(false);
    setSelectedItemId(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum item na fila</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader 
                        field="step_number" 
                        label="Etapa" 
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableHeader 
                        field="derived_status" 
                        label="Status" 
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader 
                        field="session_id" 
                        label="WhatsApp" 
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader 
                        field="name_client" 
                        label="Cliente" 
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader 
                        field="send_date" 
                        label="Agendado" 
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <StepBadge current={item.step_number} total={item.total_steps} />
                        </TableCell>
                        <TableCell>
                          <DerivedStatusBadge status={item.derived_status} />
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://wa.me/${item.session_id.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            {formatWhatsAppNumber(item.session_id)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name_client || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDbDateTime(item.send_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isUpdating}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenMessages(item)}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Ver conversa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTogglePause(item)}>
                                {item.state === 'STOP' ? (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Reativar
                                  </>
                                ) : (
                                  <>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pausar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}

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
            </>
          )}
        </CardContent>
      </Card>

      {/* Messages Dialog */}
      {selectedItem && (
        <WhatsAppMessagesDialog
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
          whatsappNumber={selectedItem.session_id}
          leadName={selectedItem.name_client}
          codAgent={selectedItem.cod_agent}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item da fila de FollowUp?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
