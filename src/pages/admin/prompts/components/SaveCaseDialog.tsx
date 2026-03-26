import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { useLegalCases, CASE_CATEGORIES } from '../hooks/useLegalCases';
import { useAuth } from '@/contexts/AuthContext';

interface SaveCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseName: string;
  caseInfo: string;
  qualificationScript: string;
  feesInfo: string;
}

export function SaveCaseDialog({ open, onOpenChange, caseName, caseInfo, qualificationScript, feesInfo }: SaveCaseDialogProps) {
  const [category, setCategory] = useState('');
  const [editCaseInfo, setEditCaseInfo] = useState(caseInfo);
  const [editScript, setEditScript] = useState(qualificationScript);
  const [editFees, setEditFees] = useState(feesInfo);
  const [editName, setEditName] = useState(caseName);
  const [isSaving, setIsSaving] = useState(false);
  const { createCase } = useLegalCases();
  const { user } = useAuth();

  // Sync props when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setEditCaseInfo(caseInfo);
      setEditScript(qualificationScript);
      setEditFees(feesInfo);
      setEditName(caseName);
      setCategory('');
    }
    onOpenChange(val);
  };

  const handleSave = async () => {
    if (!category) return;
    setIsSaving(true);
    const success = await createCase({
      case_name: editName,
      category,
      case_info: editCaseInfo,
      qualification_script: editScript,
      fees_info: editFees,
      created_by: user?.name || null,
    });
    setIsSaving(false);
    if (success) handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gravar Caso Jurídico</DialogTitle>
          <DialogDescription>Complete os dados para salvar o caso.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Caso</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Categoria do Caso *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CASE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Informações do Caso</Label>
            <Textarea value={editCaseInfo} onChange={(e) => setEditCaseInfo(e.target.value)} className="min-h-[150px] font-mono text-xs" />
          </div>

          <div className="space-y-2">
            <Label>Roteiro de Qualificação</Label>
            <Textarea value={editScript} onChange={(e) => setEditScript(e.target.value)} className="min-h-[150px] font-mono text-xs" />
          </div>

          <div className="space-y-2">
            <Label>Honorários do Caso</Label>
            <Textarea value={editFees} onChange={(e) => setEditFees(e.target.value)} className="min-h-[100px] font-mono text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!category || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
