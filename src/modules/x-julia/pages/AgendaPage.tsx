import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XJLayout } from '../components/XJLayout';
import { useXJAppointmentActions, useXJAppointments, useXJAvailability } from '../hooks/useXJAgenda';
import { useXJPermissions } from '../extend/auth';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function XJAgendaPage() {
  const { data: appointments = [], isLoading } = useXJAppointments();
  const { setStatus } = useXJAppointmentActions();
  const availability = useXJAvailability();
  const permissions = useXJPermissions('x_julia_agenda');

  const [weekday, setWeekday] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [ownerName, setOwnerName] = useState('');

  return (
    <XJLayout title="Agenda X-Julia" description="Disponibilidade e agendamentos criados pelo agente">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-40 w-full" />}
            {!isLoading && appointments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum agendamento.</p>
            )}
            {appointments.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.contact_name ?? 'Lead'} · {item.subject ?? 'Consulta'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.starts_at).toLocaleString('pt-BR')} — {new Date(item.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {item.owner_name ? ` · ${item.owner_name}` : ''}
                    {item.contact_phone ? ` · ${item.contact_phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === 'canceled' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                  {permissions.canEdit && item.status !== 'canceled' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: item.id, status: 'canceled' })}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Disponibilidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(availability.data ?? []).map((slot) => (
              <div key={slot.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <div>
                  <p className="text-sm font-medium">{WEEKDAYS[slot.weekday] ?? slot.weekday}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)} · {slot.slot_minutes} min
                    {slot.owner_name ? ` · ${slot.owner_name}` : ''}
                  </p>
                </div>
                {permissions.canDelete && (
                  <Button size="icon" variant="ghost" className="rounded-full" onClick={() => availability.remove.mutate(slot.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {permissions.canCreate && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia da semana</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((label, index) => (
                        <SelectItem key={label} value={String(index)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fim</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Slot (min)</Label>
                    <Input type="number" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável</Label>
                    <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    availability.add.mutate({
                      weekday: Number(weekday),
                      start_time: startTime,
                      end_time: endTime,
                      slot_minutes: Number(slotMinutes) || 30,
                      owner_name: ownerName || null,
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar horário
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </XJLayout>
  );
}