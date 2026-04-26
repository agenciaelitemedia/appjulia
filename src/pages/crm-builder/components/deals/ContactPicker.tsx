import { useEffect, useMemo, useState } from 'react';
import { Search, X, UserPlus, User, Phone, Mail, Loader2, AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { maskPhone } from '@/lib/inputMasks';
import { normalizeBrPhone, brPhoneVariants } from '@/lib/phoneNormalize';
import { toast } from 'sonner';

export interface PickedContact {
  id: string;
  name: string;
  phone: string; // dígitos puros incluindo DDI
  email: string | null;
}

interface Props {
  selected: PickedContact | null;
  onSelect: (contact: PickedContact) => void;
  onClear: () => void;
}

const DDI_OPTIONS = [
  { code: '55', label: '🇧🇷 +55' },
  { code: '1', label: '🇺🇸 +1' },
  { code: '351', label: '🇵🇹 +351' },
  { code: '34', label: '🇪🇸 +34' },
  { code: '54', label: '🇦🇷 +54' },
  { code: '52', label: '🇲🇽 +52' },
  { code: '44', label: '🇬🇧 +44' },
];

export function ContactPicker({ selected, onSelect, onClear }: Props) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search.trim(), 250);

  // Create form state
  const [name, setName] = useState('');
  const [ddi, setDdi] = useState('55');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [email, setEmail] = useState('');
  const [duplicate, setDuplicate] = useState<{ kind: 'phone' | 'email'; contact: PickedContact } | null>(null);
  const [saving, setSaving] = useState(false);

  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const fullPhone = normalizeBrPhone(ddi + phoneDigits);

  // Search query
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['contact-picker', clientId, debounced],
    enabled: !!clientId && mode === 'search' && debounced.length >= 2,
    staleTime: 15_000,
    queryFn: async (): Promise<PickedContact[]> => {
      const q = debounced.replace(/[%_]/g, '');
      const { data, error } = await supabase
        .from('chat_contacts')
        .select('id, name, phone, lead_email')
        .eq('client_id', clientId)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,lead_email.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.lead_email,
      }));
    },
  });

  // Reset duplicate when fields change
  useEffect(() => { setDuplicate(null); }, [phoneDigits, ddi, email]);

  const checkDuplicate = async () => {
    if (!clientId) return;
    if (phoneDigits.length < 8 && !email.trim()) return;

    // Busca por telefone (variantes BR com e sem 9º dígito) OU por e-mail
    const variants = phoneDigits.length >= 8 ? brPhoneVariants(fullPhone) : [];
    const orParts: string[] = [];
    if (variants.length > 0) {
      orParts.push(`phone.in.(${variants.join(',')})`);
    }
    if (email.trim()) orParts.push(`lead_email.ilike.${email.trim()}`);
    if (orParts.length === 0) return;

    const { data } = await supabase
      .from('chat_contacts')
      .select('id, name, phone, lead_email')
      .eq('client_id', clientId)
      .or(orParts.join(','))
      .limit(1)
      .maybeSingle();

    if (data) {
      const matchKind: 'phone' | 'email' = variants.includes(data.phone) ? 'phone' : 'email';
      setDuplicate({
        kind: matchKind,
        contact: { id: data.id, name: data.name, phone: data.phone, email: data.lead_email },
      });
    } else {
      setDuplicate(null);
    }
  };

  const canSave = name.trim().length >= 2 && phoneDigits.length >= 8 && (!duplicate || duplicate.kind === 'email');

  const handleSave = async () => {
    if (!canSave || !clientId || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('chat_contacts')
        .insert({
          client_id: clientId,
          phone: fullPhone, // já normalizado para forma canônica BR (13 díg)
          name: name.trim(),
          lead_email: email.trim() || null,
          channel_type: 'whatsapp_uazapi',
        })
        .select('id, name, phone, lead_email')
        .single();
      if (error) throw error;
      const picked: PickedContact = {
        id: data.id, name: data.name, phone: data.phone, email: data.lead_email,
      };
      onSelect(picked);
      toast.success('Contato cadastrado');
      setMode('search');
      setName(''); setPhoneRaw(''); setEmail('');
    } catch (err: any) {
      toast.error('Erro ao salvar contato: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Selected card
  if (selected) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{selected.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {formatDisplayPhone(selected.phone)}
            {selected.email ? ` · ${selected.email}` : ''}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-xs">
          Trocar
        </Button>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Novo contato
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('search')} className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Select value={ddi} onValueChange={setDdi}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DDI_OPTIONS.map(d => (
                  <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="flex-1"
              value={ddi === '55' ? maskPhone(phoneRaw) : phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value.replace(/\D/g, ''))}
              onBlur={checkDuplicate}
              placeholder={ddi === '55' ? '(11) 99999-9999' : 'Número'}
              inputMode="tel"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">E-mail</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={checkDuplicate}
            placeholder="email@exemplo.com"
            inputMode="email"
          />
        </div>

        {duplicate && (
          <Alert className={cn(
            duplicate.kind === 'phone'
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-amber-500/40 bg-amber-500/5'
          )}>
            <AlertCircle className={cn(
              'h-4 w-4',
              duplicate.kind === 'phone' ? 'text-destructive' : 'text-amber-600'
            )} />
            <AlertDescription className="text-xs space-y-2">
              <div>
                {duplicate.kind === 'phone'
                  ? 'Este telefone já está cadastrado:'
                  : 'Este e-mail já está cadastrado:'}
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-background border">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{duplicate.contact.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {formatDisplayPhone(duplicate.contact.phone)}
                    {duplicate.contact.email ? ` · ${duplicate.contact.email}` : ''}
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onSelect(duplicate.contact)}>
                  Usar
                </Button>
              </div>
              {duplicate.kind === 'phone' && (
                <div className="text-[10px]">Telefone duplicado bloqueia o cadastro. Selecione o contato existente.</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('search')}>Cancelar</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Salvar contato
          </Button>
        </div>
      </div>
    );
  }

  // search mode
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => setMode('create')} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Novo Contato
        </Button>
      </div>

      {debounced.length < 2 ? (
        <div className="text-xs text-muted-foreground p-4 text-center border rounded-lg bg-muted/10">
          Digite ao menos 2 caracteres para buscar.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : results.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 text-center border rounded-lg bg-muted/10">
          Nenhum contato encontrado. Use <span className="font-medium">Novo Contato</span> para cadastrar.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="text-[11px] text-muted-foreground px-3 py-2 bg-muted/30 border-b">
            {results.length} contato(s) encontrado(s)
          </div>
          <ScrollArea className="max-h-[280px]">
            {results.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b last:border-b-0 text-left"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formatDisplayPhone(c.phone)}
                    {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function formatDisplayPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  // BR full: 55 + DDD + 8/9 dig
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const num = d.slice(4);
    if (num.length === 9) return `+55 (${ddd}) ${num.slice(0,5)}-${num.slice(5)}`;
    return `+55 (${ddd}) ${num.slice(0,4)}-${num.slice(4)}`;
  }
  return '+' + d;
}