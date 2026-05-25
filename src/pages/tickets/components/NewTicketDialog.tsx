import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSupportConfig, useTicketMutations } from '../hooks/useTickets';
import { PRIORITY_LABEL, type TicketPriority } from '../types';

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  prefill?: { conversation_id?: string | null; contact_id?: string | null; requester_name?: string; requester_phone?: string };
}

export function NewTicketDialog({ open, onOpenChange, onCreated, prefill }: NewTicketDialogProps) {
  const { user } = useAuth();
  const { departments, categories } = useSupportConfig();
  const { create } = useTicketMutations();

  const [name, setName] = useState(prefill?.requester_name ?? user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(prefill?.requester_phone ?? '');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const deptCategories = useMemo(
    () => categories.filter((c) => !c.department_id || c.department_id === departmentId),
    [categories, departmentId],
  );

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error('Informe o assunto'); return; }
    setSaving(true);
    try {
      const id = await create.mutateAsync({
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
        department_id: departmentId || null,
        category_id: categoryId || null,
        requester_name: name.trim() || undefined,
        requester_email: email.trim() || undefined,
        requester_phone: phone.trim() || undefined,
        conversation_id: prefill?.conversation_id ?? null,
        contact_id: prefill?.contact_id ?? null,
      });
      toast.success('Chamado aberto');
      onOpenChange(false);
      onCreated?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir chamado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Abrir chamado</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(opcional)" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Departamento</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setCategoryId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={deptCategories.length === 0}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {deptCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do problema" />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" placeholder="Descreva o problema" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Abrindo…' : 'Abrir chamado'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
