import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { XJLayout } from '../components/XJLayout';
import { useXJContractActions, useXJContracts } from '../hooks/useXJContracts';
import { useXJPermissions } from '../extend/auth';
import { X_JULIA_ROUTES } from '../module';

const STATUS = [
  { id: 'all', label: 'Todos' },
  { id: 'draft', label: 'Rascunho' },
  { id: 'sent', label: 'Enviado' },
  { id: 'signed', label: 'Assinado' },
  { id: 'canceled', label: 'Cancelado' },
];

const statusVariant = (status: string) =>
  status === 'signed' ? 'default' : status === 'canceled' ? 'destructive' : 'secondary';

export default function XJContractsPage() {
  const [status, setStatus] = useState('all');
  const { data: contracts = [], isLoading } = useXJContracts(status);
  const { setStatus: updateStatus, remove } = useXJContractActions();
  const permissions = useXJPermissions('x_julia_contracts');

  return (
    <XJLayout
      title="Contratos X-Julia"
      description="Contratos gerados pelo agente e status de assinatura"
      actions={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Card>
        <CardContent className="pt-6">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {!isLoading && contracts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
          )}
          {!isLoading && contracts.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signatário</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.signer_name ?? '—'}</TableCell>
                    <TableCell>{contract.signer_document ?? '—'}</TableCell>
                    <TableCell>
                      {typeof contract.value === 'number'
                        ? contract.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </TableCell>
                    <TableCell>{contract.provider}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(contract.status) as any}>{contract.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(contract.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="rounded-full">
                          <Link
                            to={X_JULIA_ROUTES.contractSign.replace(':contractId', contract.id)}
                            title="Abrir contrato"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        {permissions.canEdit && contract.status !== 'signed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus.mutate({ id: contract.id, status: 'signed' })}
                          >
                            Marcar assinado
                          </Button>
                        )}
                        {permissions.canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => remove.mutate(contract.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </XJLayout>
  );
}