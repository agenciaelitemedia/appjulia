import { useState, useEffect } from 'react';
import { Plus, Loader2, MessageSquare, Pencil, Trash2, Building2, Check, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useChatClientSettings,
  useChatClientSettingsMutations,
  type ChatClientSettingRow,
} from '../hooks/useChatClientSettings';
import { ChatSettingsDialog } from './ChatSettingsDialog';

export function ChatSettingsTab() {
  const { data: settings = [], isLoading } = useChatClientSettings();
  const { deleteSettings } = useChatClientSettingsMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChatClientSettingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatClientSettingRow | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const q = search.trim().toLowerCase();
  const filteredSettings = q
    ? settings.filter((row) => {
        const haystack = [row.client_name, row.client_business_name, String(row.client_id)]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
    : settings;

  const totalPages = Math.max(1, Math.ceil(filteredSettings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedSettings = filteredSettings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (row: ChatClientSettingRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configurações do Chat</h2>
          <p className="text-sm text-muted-foreground">
            Defina por cliente o limite de filas, permissão de grupos e outras opções do módulo de chat
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova Configuração
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, razão social ou ID..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : settings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-1 font-medium">Nenhuma configuração de chat</p>
          <p className="text-sm">Adicione uma configuração por cliente para personalizar o comportamento do chat</p>
        </div>
      ) : filteredSettings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-1 font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm">Tente outro termo de busca</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg divide-y">
            {paginatedSettings.map((row) => (
              <div key={row.id} className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{row.client_name || `Cliente ${row.client_id}`}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {row.client_business_name || `ID ${row.client_id}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">
                    {row.settings.QUEUE_LIMIT} {row.settings.QUEUE_LIMIT === 1 ? 'fila' : 'filas'}
                  </Badge>
                  <Badge variant={row.settings.ALLOW_GROUPS ? 'default' : 'secondary'} className="gap-1">
                    {row.settings.ALLOW_GROUPS ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Grupos
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((safePage - 1) * PAGE_SIZE) + 1}-{Math.min(safePage * PAGE_SIZE, filteredSettings.length)} de {filteredSettings.length} clientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ChatSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover configuração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a configuração de chat de "{deleteTarget?.client_name ?? deleteTarget?.client_id}"?
              O cliente voltará aos valores padrão (1 fila, sem grupos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteSettings.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
