import { Search, UserRound, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserSearch } from '@/pages/agents/hooks/useUserSearch';
import {
  useHelpStudioEditors,
  useAddHelpStudioEditor,
  useRemoveHelpStudioEditor,
} from '@/hooks/useHelpStudioAccess';

export function HelpPermissionsTab() {
  const { searchTerm, setSearchTerm, results, isLoading: searching, clearSearch } = useUserSearch();
  const { data: editors = [], isLoading } = useHelpStudioEditors();
  const addEditor = useAddHelpStudioEditor();
  const removeEditor = useRemoveHelpStudioEditor();

  const linkedIds = new Set(editors.map(e => e.user_id));

  const handleLink = (u: { id: number; name: string; email: string }) => {
    addEditor.mutate(u, { onSuccess: () => clearSearch() });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Vincular Usuário</h2>
        <p className="text-sm text-muted-foreground">
          Busque um usuário existente para liberar o acesso ao Studio da Central de Ajuda
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar usuário por nome ou email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Resultados da busca */}
      {searchTerm.trim().length >= 3 && (
        <Card>
          <CardContent className="p-2">
            {results.length === 0 && !searching ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado</p>
            ) : (
              <div className="divide-y divide-border">
                {results.map(u => {
                  const alreadyLinked = linkedIds.has(u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="outline" className="hidden sm:inline-flex">{u.role}</Badge>
                      {alreadyLinked ? (
                        <Badge variant="secondary">Vinculado</Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="rounded-full"
                          disabled={addEditor.isPending}
                          onClick={() => handleLink(u)}
                        >
                          Vincular
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usuários vinculados */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            Usuários com acesso ao Studio
            {editors.length > 0 && (
              <span className="text-muted-foreground font-normal"> · {editors.length}</span>
            )}
          </h3>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : editors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <UserRound className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Busque um usuário existente
                <br />
                para vincular o acesso ao Studio
              </p>
              <p className="text-xs text-muted-foreground/70">
                Administradores já possuem acesso por padrão
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {editors.map(e => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(e.user_name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.user_name || `Usuário #${e.user_id}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.user_email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive hover:text-destructive"
                    disabled={removeEditor.isPending}
                    onClick={() => removeEditor.mutate(e.id)}
                    title="Remover acesso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}