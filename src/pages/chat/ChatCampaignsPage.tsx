import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Send, Plus, Play, X } from 'lucide-react';
import { useChatCampaigns, type ChatCampaign } from '@/hooks/useChatCampaigns';

const statusVariant: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-700',
  running: 'bg-amber-500/10 text-amber-700',
  completed: 'bg-emerald-500/10 text-emerald-700',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

export default function ChatCampaignsPage() {
  const { campaigns, loading, create, dispatch, cancel } = useChatCampaigns();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatCampaign>>({ name: '', message_text: '', throttle_seconds: 5 });

  const handleCreate = async () => {
    if (!draft.name || !draft.message_text) return;
    const c = await create(draft);
    if (c) { setOpen(false); setDraft({ name: '', message_text: '', throttle_seconds: 5 }); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" /> Campanhas em Massa
          </h1>
          <p className="text-sm text-muted-foreground">Disparos segmentados com throttling e relatório.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova campanha
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhuma campanha criada ainda.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const pct = c.contacts_total > 0 ? Math.round(((c.contacts_sent + c.contacts_failed) / c.contacts_total) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge className={statusVariant[c.status] || ''} variant="outline">{c.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{c.message_text}</p>
                    </div>
                    {c.status === 'draft' && (
                      <Button size="sm" onClick={() => dispatch(c.id)}>
                        <Play className="h-3 w-3 mr-1" /> Disparar
                      </Button>
                    )}
                    {(c.status === 'running' || c.status === 'scheduled') && (
                      <Button size="sm" variant="outline" onClick={() => cancel(c.id)}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                  {c.contacts_total > 0 && (
                    <>
                      <Progress value={pct} className="h-2" />
                      <p className="text-[11px] text-muted-foreground">
                        {c.contacts_sent} enviados · {c.contacts_failed} falhas · {c.contacts_total} total ({pct}%)
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Mensagem</Label><Textarea rows={4} value={draft.message_text || ''} onChange={(e) => setDraft({ ...draft, message_text: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal (opcional)</Label>
                <Input placeholder="whatsapp_uazapi" value={draft.filter_channel || ''} onChange={(e) => setDraft({ ...draft, filter_channel: e.target.value || null })} />
              </div>
              <div>
                <Label>Intervalo (segundos)</Label>
                <Input type="number" min={0} value={draft.throttle_seconds ?? 5} onChange={(e) => setDraft({ ...draft, throttle_seconds: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A campanha enviará para todos os contatos do canal selecionado (ou todos se vazio). O envio é gravado em chat_messages.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
