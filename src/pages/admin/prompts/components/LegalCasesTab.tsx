import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, Eye, Plus, Loader2, Pencil, History } from 'lucide-react';
import { useLegalCases, CASE_CATEGORIES, type LegalCase } from '../hooks/useLegalCases';
import { useLegalCaseVersions, type LegalCaseVersion } from '../hooks/useLegalCaseVersions';
import { SaveCaseDialog } from './SaveCaseDialog';
import { LegalCaseHistoryDialog } from './LegalCaseHistoryDialog';

export function LegalCasesTab() {
  const { user } = useAuth();
  const { cases, isLoading, deleteCase, updateCase } = useLegalCases();
  const { saveVersion } = useLegalCaseVersions();
  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Edit state
  const [editConfirmCase, setEditConfirmCase] = useState<LegalCase | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCaseInfo, setFormCaseInfo] = useState('');
  const [formQualification, setFormQualification] = useState('');
  const [formFees, setFormFees] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<LegalCase | null>(null);
  const [deleteTypedName, setDeleteTypedName] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // History state
  const [historyCase, setHistoryCase] = useState<LegalCase | null>(null);

  const filtered = cases.filter((c) => {
    const matchName = !searchName || c.case_name.toLowerCase().includes(searchName.toLowerCase());
    const matchCat = filterCategory === 'all' || c.category === filterCategory;
    return matchName && matchCat;
  });

  const categoryColor = (cat: string) => {
    if (cat.includes('PREVIDENCIÁRIO') || cat.includes('Previdenciário')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (cat.includes('TRABALHISTA') || cat.includes('Trabalhista')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    if (cat.includes('CONSUMIDOR') || cat.includes('Consumidor')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (cat.includes('FAMÍLIA') || cat.includes('Família')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    if (cat.includes('PENAL') || cat.includes('Penal')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    return 'bg-muted text-muted-foreground';
  };

  // Edit flow
  const confirmEdit = (c: LegalCase) => {
    setEditConfirmCase(c);
  };

  const proceedEdit = () => {
    if (!editConfirmCase) return;
    setEditingCase(editConfirmCase);
    setFormName(editConfirmCase.case_name);
    setFormCategory(editConfirmCase.category);
    setFormCaseInfo(editConfirmCase.case_info || '');
    setFormQualification(editConfirmCase.qualification_script || '');
    setFormFees(editConfirmCase.fees_info || '');
    setEditConfirmCase(null);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCase || !formName.trim()) return;
    setSaving(true);

    // Build change summary
    const changes: string[] = [];
    if (formName.trim() !== editingCase.case_name) changes.push('Nome');
    if (formCategory !== editingCase.category) changes.push('Categoria');
    if (formCaseInfo !== (editingCase.case_info || '')) changes.push('Informações');
    if (formQualification !== (editingCase.qualification_script || '')) changes.push('Roteiro');
    if (formFees !== (editingCase.fees_info || '')) changes.push('Honorários');
    const changeSummary = changes.length > 0 ? `Alterado: ${changes.join(', ')}` : 'Sem alterações';

    // Save version snapshot before updating
    await saveVersion(
      editingCase.id,
      {
        case_name: editingCase.case_name,
        category: editingCase.category,
        case_info: editingCase.case_info,
        qualification_script: editingCase.qualification_script,
        fees_info: editingCase.fees_info,
      },
      user?.name || null,
      changeSummary
    );

    const ok = await updateCase(editingCase.id, {
      case_name: formName.trim(),
      category: formCategory,
      case_info: formCaseInfo || null,
      qualification_script: formQualification || null,
      fees_info: formFees || null,
    });

    setSaving(false);
    if (ok) setEditDialogOpen(false);
  };

  // Delete flow
  const openDelete = (c: LegalCase) => {
    setDeleting(c);
    setDeleteTypedName('');
    setDeleteConfirmed(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    await deleteCase(deleting.id);
    setDeleteLoading(false);
    setDeleting(null);
  };

  const deleteNameMatch = deleting ? deleteTypedName === deleting.case_name : false;
  const canDelete = deleteNameMatch && deleteConfirmed && !deleteLoading;

  // Restore from history
  const handleRestore = async (version: LegalCaseVersion) => {
    // Save current state as version before restoring
    const currentCase = cases.find(c => c.id === version.case_id);
    if (currentCase) {
      await saveVersion(
        currentCase.id,
        {
          case_name: currentCase.case_name,
          category: currentCase.category,
          case_info: currentCase.case_info,
          qualification_script: currentCase.qualification_script,
          fees_info: currentCase.fees_info,
        },
        user?.name || null,
        'Snapshot antes de restauração'
      );
    }

    await updateCase(version.case_id, {
      case_name: version.case_name,
      category: version.category,
      case_info: version.case_info,
      qualification_script: version.qualification_script,
      fees_info: version.fees_info,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CASE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Caso
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum caso jurídico encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedCase(c)}>
                  <div>
                    <p className="font-medium">{c.case_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      {c.created_by && ` • ${c.created_by}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={categoryColor(c.category)}>{c.category}</Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setSelectedCase(c)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Histórico" onClick={() => setHistoryCase(c)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => confirmEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => openDelete(c)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog (read-only) */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCase?.case_name}</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <Badge className={categoryColor(selectedCase.category)}>{selectedCase.category}</Badge>
              <div className="space-y-2">
                <Label className="font-semibold">Lista de Caso Jurídico</Label>
                <Textarea value={selectedCase.case_info || ''} readOnly className="min-h-[200px] font-mono text-xs bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Roteiro de Qualificação</Label>
                <Textarea value={selectedCase.qualification_script || ''} readOnly className="min-h-[300px] font-mono text-xs bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Honorários do Caso</Label>
                <Textarea value={selectedCase.fees_info || ''} readOnly className="min-h-[150px] font-mono text-xs bg-muted/30" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Confirm Dialog */}
      <AlertDialog open={!!editConfirmCase} onOpenChange={open => !open && setEditConfirmCase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Edição</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja editar o caso <strong>"{editConfirmCase?.case_name}"</strong>? As alterações substituirão os dados atuais. Um snapshot será salvo no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={proceedEdit}>Sim, Editar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Caso Jurídico</DialogTitle>
            <DialogDescription>Atualize os dados do caso. Um snapshot da versão anterior será salvo automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Informações do Caso</Label>
              <Textarea value={formCaseInfo} onChange={e => setFormCaseInfo(e.target.value)} className="min-h-[200px] font-mono text-xs" />
            </div>
            <div>
              <Label>Roteiro de Qualificação</Label>
              <Textarea value={formQualification} onChange={e => setFormQualification(e.target.value)} className="min-h-[250px] font-mono text-xs" />
            </div>
            <div>
              <Label>Honorários</Label>
              <Textarea value={formFees} onChange={e => setFormFees(e.target.value)} className="min-h-[150px] font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !formName.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Caso Jurídico</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Para confirmar, digite o nome do caso abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome do caso:</Label>
              <Input value={deleting?.case_name || ''} readOnly className="bg-muted font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-case-name" className="text-sm font-medium">Digite o nome para confirmar:</Label>
              <Input
                id="delete-case-name"
                value={deleteTypedName}
                onChange={e => setDeleteTypedName(e.target.value)}
                placeholder="Digite o nome exato..."
                className={deleteTypedName && !deleteNameMatch ? 'border-destructive' : ''}
                disabled={deleteLoading}
              />
              {deleteTypedName && !deleteNameMatch && (
                <p className="text-xs text-destructive">O nome não corresponde</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="delete-case-check"
                checked={deleteConfirmed}
                onCheckedChange={checked => setDeleteConfirmed(checked === true)}
                disabled={deleteLoading}
              />
              <Label htmlFor="delete-case-check" className="text-sm font-medium leading-none">
                Confirmo que desejo excluir este caso permanentemente
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
              {deleteLoading ? 'Excluindo...' : 'Excluir Caso'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <LegalCaseHistoryDialog
        legalCase={historyCase}
        open={!!historyCase}
        onOpenChange={(open) => !open && setHistoryCase(null)}
        onRestore={handleRestore}
      />

      {/* New Case Dialog */}
      <SaveCaseDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        caseName=""
        caseInfo=""
        qualificationScript=""
        feesInfo=""
      />
    </div>
  );
}
