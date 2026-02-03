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
import { cn } from '@/lib/utils';
import { PIPELINE_COLORS, type CRMPipelineFormData, type CRMPipeline } from '../../types';

interface CreatePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CRMPipelineFormData) => Promise<CRMPipeline | null>;
  editPipeline?: CRMPipeline | null;
}

export function CreatePipelineDialog({
  open,
  onOpenChange,
  onSubmit,
  editPipeline,
}: CreatePipelineDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(editPipeline?.name || '');
  const [color, setColor] = useState(editPipeline?.color || PIPELINE_COLORS[0]);
  const [winProbability, setWinProbability] = useState(
    editPipeline?.win_probability?.toString() || '0'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        name: name.trim(),
        color,
        win_probability: parseInt(winProbability) || 0,
      });

      if (result) {
        onOpenChange(false);
        // Reset form
        setName('');
        setColor(PIPELINE_COLORS[0]);
        setWinProbability('0');
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
              {editPipeline ? 'Editar Etapa' : 'Nova Etapa'}
            </DialogTitle>
            <DialogDescription>
              {editPipeline 
                ? 'Atualize as informações da etapa.'
                : 'Adicione uma nova etapa ao pipeline.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Etapa</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Lead, Qualificado, Proposta..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="probability">Probabilidade de Ganho (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={winProbability}
                onChange={(e) => setWinProbability(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular previsões de receita
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PIPELINE_COLORS.map((c) => (
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
              {isSubmitting ? 'Salvando...' : editPipeline ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
