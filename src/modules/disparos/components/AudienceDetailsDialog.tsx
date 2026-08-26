import { useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Trash2, Users } from 'lucide-react';
import { displayPhone } from '../extend/phone';
import {
  useAddAudienceContacts,
  useDspAudienceContacts,
  useRefreshAudience,
  useRemoveAudienceContact,
  type NewAudienceContact,
} from '../hooks/useDspAudiences';
import type { AudienceCsvResult } from '../lib/audienceCsv';
import type { DspAudience, DspAudienceRefreshDiff } from '../types';
import { AudienceCsvStep } from './AudienceCsvStep';
import { AudienceManualStep, parseManualLines } from './AudienceManualStep';

interface Props {
  audience: DspAudience | null;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
}

export function AudienceDetailsDialog({ audience, onOpenChange, canEdit }: Props) {
  const [search, setSearch] = useState('');
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [csvResult, setCsvResult] = useState<AudienceCsvResult | null>(null);
  const [manualText, setManualText] = useState('');
  const [diff, setDiff] = useState<DspAudienceRefreshDiff | null>(null);

  const contacts = useDspAudienceContacts(audience?.id ?? null, search, includeRemoved);
  const addContacts = useAddAudienceContacts();
  const removeContact = useRemoveAudienceContact();
  const refresh = useRefreshAudience();

  const manualEntries = useMemo(() => parseManualLines(manualText).filter((e) => e.valid), [manualText]);

  if (!audience) return null;

  const importCsv = async () => {
    const rows: NewAudienceContact[] = (csvResult?.valid ?? []).map((r) => ({
      phone_e164: r.phone,
      name: r.name || null,
      first_name: r.first_name || null,
      email: r.email,
      document: r.variables.documento ?? null,
      extra: Object.keys(r.variables).length ? r.variables : null,
    }));
    await addContacts.mutateAsync({
      audience_id: audience.id,
      client_id: audience.client_id,
      contacts: rows,
      origin: 'csv',
    });
    setCsvResult(null);
  };

  const importManual = async () => {
    await addContacts.mutateAsync({
      audience_id: audience.id,
      client_id: audience.client_id,
      contacts: manualEntries.map((r) => ({ phone_e164: r.phone, name: r.name || null })),
      origin: 'manual',
    });
    setManualText('');
  };

  return (
    <Dialog open={!!audience} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {audience.name}
          </DialogTitle>
          <DialogDescription>
            {audience.total_active} ativo(s) · {audience.total_removed} removido(s) ·{' '}
            origem: {audience.source === 'filter' ? 'filtro da Julia' : audience.source === 'csv' ? 'CSV' : 'manual'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="contatos">
          <TabsList>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            {canEdit && <TabsTrigger value="incluir">Incluir contatos</TabsTrigger>}
            {canEdit && audience.source === 'filter' && <TabsTrigger value="atualizar">Atualizar pelo filtro</TabsTrigger>}
          </TabsList>

          <TabsContent value="contatos" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou número"
                className="h-8 max-w-xs text-xs"
              />
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={includeRemoved} onCheckedChange={setIncludeRemoved} />
                Mostrar removidos
              </label>
            </div>
            <ScrollArea className="h-80 rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="p-2 text-left font-medium">Nome</th>
                    <th className="p-2 text-left font-medium">WhatsApp</th>
                    <th className="p-2 text-left font-medium">Origem</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {(contacts.data ?? []).map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.name || <span className="text-muted-foreground">sem nome</span>}</td>
                      <td className="p-2 font-mono">{displayPhone(c.phone_e164)}</td>
                      <td className="p-2 text-muted-foreground">{c.origin}</td>
                      <td className="p-2">
                        {c.status === 'active' ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">ativo</Badge>
                        ) : (
                          <Badge variant="outline">removido</Badge>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {canEdit && c.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => removeContact.mutate({ id: c.id, audience_id: audience.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!contacts.isLoading && (contacts.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum contato encontrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>

          {canEdit && (
            <TabsContent value="incluir" className="mt-4 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">Importar planilha</p>
                <AudienceCsvStep result={csvResult} onResult={setCsvResult} />
                <Button
                  size="sm"
                  disabled={!csvResult?.valid.length || addContacts.isPending}
                  onClick={importCsv}
                >
                  {addContacts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Incluir {csvResult?.valid.length ?? 0} contato(s) do CSV
                </Button>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Cadastro manual</p>
                <AudienceManualStep value={manualText} onChange={setManualText} />
                <Button size="sm" disabled={!manualEntries.length || addContacts.isPending} onClick={importManual}>
                  {addContacts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Incluir {manualEntries.length} contato(s)
                </Button>
              </div>
            </TabsContent>
          )}

          {canEdit && audience.source === 'filter' && (
            <TabsContent value="atualizar" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Reexecuta o filtro salvo e compara com o público atual. Novos contatos são inseridos e os que saíram
                do filtro são marcados como removidos (o histórico é preservado).
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={refresh.isPending}
                onClick={async () => setDiff(await refresh.mutateAsync({ audience_id: audience.id, apply: false }))}
              >
                {refresh.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Verificar diferenças
              </Button>

              {diff && !diff.applied && (
                <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{diff.resolved} no filtro atual</Badge>
                    <Badge variant="outline">{diff.current_active} no público</Badge>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">+{diff.to_add} novos</Badge>
                    <Badge variant="destructive">{diff.to_remove} a remover</Badge>
                    {(diff.to_restore ?? 0) > 0 && <Badge variant="outline">{diff.to_restore} a reativar</Badge>}
                  </div>
                  {(diff.to_add ?? 0) + (diff.to_remove ?? 0) + (diff.to_restore ?? 0) === 0 ? (
                    <p className="text-muted-foreground">O público já está sincronizado com o filtro.</p>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm">Aplicar atualização</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Atualizar público?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Serão inseridos {diff.to_add} contato(s) e marcados como removidos {diff.to_remove}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              const res = await refresh.mutateAsync({ audience_id: audience.id, apply: true });
                              setDiff(res);
                            }}
                          >
                            Aplicar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}

              {diff?.applied && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                  Atualizado: +{diff.added} novos, {diff.removed} removidos, {diff.restored} reativados. Total ativo:{' '}
                  {diff.total}.
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
