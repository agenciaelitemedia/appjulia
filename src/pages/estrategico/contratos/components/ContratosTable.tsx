import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Eye } from 'lucide-react';
import { JuliaContrato } from '../../types';
import { formatDbDateTime } from '@/lib/dateUtils';

interface ContratosTableProps {
  contratos: JuliaContrato[];
  isLoading?: boolean;
  searchTerm?: string;
  onViewDetails: (contrato: JuliaContrato) => void;
}

export function ContratosTable({
  contratos,
  isLoading,
  searchTerm = '',
  onViewDetails,
}: ContratosTableProps) {
  const filteredContratos = useMemo(() => {
    if (!searchTerm) return contratos;
    
    const term = searchTerm.toLowerCase();
    return contratos.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.business_name?.toLowerCase().includes(term) ||
      c.whatsapp?.includes(term) ||
      c.signer_name?.toLowerCase().includes(term) ||
      c.cod_agent?.includes(term)
    );
  }, [contratos, searchTerm]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filteredContratos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum contrato encontrado</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      CREATED: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100', label: 'Criado' },
      SIGNED: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Assinado' },
      PENDING: { className: 'bg-orange-100 text-orange-800 hover:bg-orange-100', label: 'Pendente' },
      CANCELLED: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Cancelado' },
    };
    return variants[status] || { className: 'bg-gray-100 text-gray-800', label: status };
  };

  const getSituacaoBadge = (situacao: string) => {
    const variants: Record<string, { className: string }> = {
      'EM CURSO': { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
      'FINALIZADO': { className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      'CANCELADO': { className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    };
    return variants[situacao] || { className: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agente</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Data Contrato</TableHead>
            <TableHead>Assinatura</TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContratos.map((contrato) => {
            const statusInfo = getStatusBadge(contrato.status_document);
            const situacaoInfo = getSituacaoBadge(contrato.situacao);
            
            return (
              <TableRow key={`${contrato.cod_document}-${contrato.session_id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">[{contrato.cod_agent}]</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {contrato.name}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium truncate max-w-[150px]">
                    {contrato.signer_name || '-'}
                  </p>
                </TableCell>
                <TableCell>
                  <a
                    href={`https://wa.me/${contrato.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {contrato.whatsapp}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={situacaoInfo.className}>
                    {contrato.situacao}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDbDateTime(contrato.data_contrato)}
                </TableCell>
                <TableCell className="text-sm">
                  {contrato.data_assinatura
                    ? formatDbDateTime(contrato.data_assinatura)
                    : <span className="text-muted-foreground">Pendente</span>}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetails(contrato)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
