import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { PhoneExtension } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extension: PhoneExtension | null;
}

export function SipManualCredentialsDialog({ open, onOpenChange, extension }: Props) {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && extension) {
      setDomain((extension as any).sip_manual_domain || '');
      setUsername((extension as any).sip_manual_username || '');
      setPassword((extension as any).sip_manual_password || '');
    }
  }, [open, extension]);

  const handleSave = async () => {
    if (!extension) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('phone_extensions')
        .update({
          sip_manual_domain: domain.trim() || null,
          sip_manual_username: username.trim() || null,
          sip_manual_password: password.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', extension.id);
      if (error) throw error;
      toast.success('Credenciais SIP manuais salvas. Recarregue para aplicar.');
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar credenciais');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!extension) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('phone_extensions')
        .update({
          sip_manual_domain: null,
          sip_manual_username: null,
          sip_manual_password: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', extension.id);
      if (error) throw error;
      toast.success('Credenciais manuais removidas.');
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao limpar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Credenciais SIP manuais (3C+)</DialogTitle>
          <DialogDescription>
            Use estes campos quando o login automático da 3C+ falhar (erro 403 / sem licença Webphone).
            Copie os valores exatamente como aparecem no painel da 3C+ em "Ramal SIP externo".
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Quando preenchidas, estas credenciais têm <strong>prioridade máxima</strong> sobre o login
            automático. Para voltar a usar o login automático, clique em <em>Limpar</em>.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="sip-domain">Servidor SIP</Label>
            <Input
              id="sip-domain"
              placeholder="ex.: assessoria.3c.fluxoti.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sip-username">Usuário do ramal</Label>
            <Input
              id="sip-username"
              placeholder="ex.: B0lse3Z0EV"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sip-password">Senha do ramal</Label>
            <Input
              id="sip-password"
              type="text"
              placeholder="ex.: pYWWebrY0f"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleClear} disabled={saving}>
            Limpar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !domain.trim() || !username.trim() || !password.trim()}>
            {saving ? 'Salvando...' : 'Salvar credenciais'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}