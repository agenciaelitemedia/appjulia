import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { toast } from 'sonner';

export function UserPlansTab() {
  const { plans, userPlans, userPlansLoading, assignPlan } = useTelefoniaAdmin();
  const [codAgent, setCodAgent] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const activePlans = plans.filter((p) => p.is_active);

  const handleAssign = () => {
    if (!codAgent || !selectedPlanId) {
      toast.error('Informe o Cod Agent e selecione um plano');
      return;
    }
    assignPlan.mutate({ codAgent, planId: Number(selectedPlanId) });
    setCodAgent('');
    setSelectedPlanId('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vincular Planos a Agentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assign form */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Cod Agent</label>
            <Input value={codAgent} onChange={(e) => setCodAgent(e.target.value)} placeholder="Ex: 12345" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Plano</label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.max_extensions} ramais)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={assignPlan.isPending}>
            <UserPlus className="h-4 w-4 mr-1" /> Vincular
          </Button>
        </div>

        {/* Active assignments */}
        {userPlansLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod Agent</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Máx. Ramais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vinculado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userPlans.map((up) => (
                <TableRow key={up.id}>
                  <TableCell className="font-mono">{up.cod_agent}</TableCell>
                  <TableCell className="font-medium">{up.plan_name || '-'}</TableCell>
                  <TableCell>{up.max_extensions || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={up.is_active ? 'default' : 'secondary'}>
                      {up.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(up.assigned_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
              {userPlans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum vínculo</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
