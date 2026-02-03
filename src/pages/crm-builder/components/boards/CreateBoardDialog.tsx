import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  LayoutDashboard,
  Kanban,
  Briefcase,
  Users,
  Target,
  Trophy,
  ShoppingCart,
  Heart,
  Star,
  Zap,
  Rocket,
  Building,
  Home,
  Phone,
  Mail,
  Calendar,
  Folder,
  FileText,
  Clipboard,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_COLORS, BOARD_ICONS, type CRMBoardFormData, type CRMBoard } from '../../types';

// Icon mapping
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  'layout-dashboard': LayoutDashboard,
  'kanban': Kanban,
  'briefcase': Briefcase,
  'users': Users,
  'target': Target,
  'trophy': Trophy,
  'shopping-cart': ShoppingCart,
  'heart': Heart,
  'star': Star,
  'zap': Zap,
  'rocket': Rocket,
  'building': Building,
  'home': Home,
  'phone': Phone,
  'mail': Mail,
  'calendar': Calendar,
  'folder': Folder,
  'file-text': FileText,
  'clipboard': Clipboard,
  'check-square': CheckSquare,
};

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CRMBoardFormData) => Promise<CRMBoard | null>;
  editBoard?: CRMBoard | null;
}

export function CreateBoardDialog({
  open,
  onOpenChange,
  onSubmit,
  editBoard,
}: CreateBoardDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(editBoard?.name || '');
  const [description, setDescription] = useState(editBoard?.description || '');
  const [icon, setIcon] = useState(editBoard?.icon || 'layout-dashboard');
  const [color, setColor] = useState(editBoard?.color || BOARD_COLORS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
      });

      if (result) {
        onOpenChange(false);
        // Reset form
        setName('');
        setDescription('');
        setIcon('layout-dashboard');
        setColor(BOARD_COLORS[0]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editBoard ? 'Editar Board' : 'Novo Board'}
            </DialogTitle>
            <DialogDescription>
              {editBoard 
                ? 'Atualize as informações do seu board.'
                : 'Crie um novo board para organizar seus negócios.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vendas, Suporte, Recrutamento..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Uma breve descrição do board..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-10 gap-1">
                {BOARD_ICONS.map((iconName) => {
                  const IconComp = iconComponents[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={cn(
                        'p-2 rounded-lg border-2 transition-all',
                        icon === iconName
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:bg-muted'
                      )}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      color === c
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Salvando...' : editBoard ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
