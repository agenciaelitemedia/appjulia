import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useVideoPlans, useSaveVideoPlan, useDeleteVideoPlan } from '../hooks/useVideoPlans';
import { PlanDialog } from './PlanDialog';
import type { VideoPlan } from '@/pages/video/contratar/types';

const fmt = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VideoPlansTab() {
  const { data: plans = [], isLoading } = useVideoPlans();
  const save = useSaveVideoPlan();
  const del = useDeleteVideoPlan();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VideoPlan | null>(null);

  const handleSave = (p: Partial<VideoPlan>) => {
    save.mutate(editing ? { ...p, id: editing.id } : p, {
      onSuccess: () => { setOpen(false); setEditing(null); },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Planos de Videochamadas</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Plano
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Minutos</TableHead>
                  <TableHead>Salas</TableHead>
                  <TableHead>Mensal</TableHead>
                  <TableHead>Trimestral</TableHead>
                  <TableHead>Semestral</TableHead>
                  <TableHead>Anual</TableHead>
                  <TableHead>Pacote Extra</TableHead>
                  <TableHead>Inclusos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tabular-nums">{Number(p.included_minutes).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="tabular-nums">{p.max_concurrent_rooms}</TableCell>
                    <TableCell className="text-xs">{fmt(p.price_monthly)}</TableCell>
                    <TableCell className="text-xs">{fmt(p.price_quarterly)}</TableCell>
                    <TableCell className="text-xs">{fmt(p.price_semiannual)}</TableCell>
                    <TableCell className="text-xs">{fmt(p.price_annual)}</TableCell>
                    <TableCell className="text-xs">
                      {Number(p.extra_minutes_pack_size).toLocaleString('pt-BR')} min · {fmt(p.extra_minutes_pack_price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.recording_included && <Badge variant="secondary" className="text-[10px]">Gravação</Badge>}
                        {p.transcription_included && <Badge variant="secondary" className="text-[10px]">Transcrição</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm(`Excluir plano "${p.name}"?`)) del.mutate(p.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">Nenhum plano cadastrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} onSave={handleSave} />
    </Card>
  );
}