import { useState, useEffect } from 'react';
import { Users, Search, User, Bot, ChevronRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { externalDb } from '@/lib/externalDb';
import { useUserSearch, SearchedUser } from '../hooks/useUserSearch';
import { useAgentSearch, SearchedAgent } from '../hooks/useAgentSearch';

interface MonitorAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type DialogStep = 'user' | 'agent' | 'confirm';

export function MonitorAgentDialog({ open, onOpenChange, onSuccess }: MonitorAgentDialogProps) {
  const [step, setStep] = useState<DialogStep>('user');
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SearchedAgent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // User search hook
  const userSearch = useUserSearch();
  
  // Agent search hook
  const agentSearch = useAgentSearch();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('user');
        setSelectedUser(null);
        setSelectedAgent(null);
        userSearch.clearSearch();
        agentSearch.clearSearch();
      }, 200);
    }
  }, [open]);

  const handleSelectUser = (user: SearchedUser) => {
    setSelectedUser(user);
    setStep('agent');
  };

  const handleSelectAgent = (agent: SearchedAgent) => {
    setSelectedAgent(agent);
    setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'agent') {
      setStep('user');
      agentSearch.clearSearch();
    } else if (step === 'confirm') {
      setStep('agent');
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser || !selectedAgent) return;

    setIsSubmitting(true);
    try {
      await externalDb.insertUserAgent(
        selectedUser.id,
        null,                      // agent_id = NULL → monitorado
        selectedAgent.cod_agent
      );
      toast.success('Agente vinculado com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error linking agent:', error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('Este usuário já está vinculado a este agente');
      } else {
        toast.error('Erro ao vincular agente');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'user':
        return 'Selecionar Usuário';
      case 'agent':
        return 'Selecionar Agente';
      case 'confirm':
        return 'Confirmar Vinculação';
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'user':
        return 1;
      case 'agent':
        return 2;
      case 'confirm':
        return 3;
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Monitorar Agente
          </DialogTitle>
          <DialogDescription>
            Etapa {getStepNumber()} de 3: {getStepTitle()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Select User */}
          {step === 'user' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário por nome ou email (min. 3 caracteres)..."
                  value={userSearch.searchTerm}
                  onChange={(e) => userSearch.setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[280px] pr-4">
                {userSearch.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : userSearch.error ? (
                  <div className="text-center py-8 text-destructive">
                    {userSearch.error}
                  </div>
                ) : userSearch.results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {userSearch.searchTerm.length < 3
                      ? 'Digite pelo menos 3 caracteres para buscar'
                      : 'Nenhum usuário encontrado'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userSearch.results.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step 2: Select Agent */}
          {step === 'agent' && (
            <div className="space-y-4">
              {selectedUser && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Usuário: <span className="font-medium">{selectedUser.name}</span>
                  </span>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar agente por código ou nome do escritório..."
                  value={agentSearch.searchTerm}
                  onChange={(e) => agentSearch.setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[220px] pr-4">
                {agentSearch.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : agentSearch.error ? (
                  <div className="text-center py-8 text-destructive">
                    {agentSearch.error}
                  </div>
                ) : agentSearch.results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {agentSearch.searchTerm.length < 2
                      ? 'Digite pelo menos 2 caracteres para buscar'
                      : 'Nenhum agente encontrado'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentSearch.results.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {agent.business_name || agent.client_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Código: {agent.cod_agent}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedUser && selectedAgent && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usuário</p>
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="h-px w-16 bg-border" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agente</p>
                    <p className="font-medium">
                      {selectedAgent.business_name || selectedAgent.client_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Código: {selectedAgent.cod_agent}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                O usuário poderá monitorar este agente após a vinculação.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          {step !== 'user' && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          
          {step === 'confirm' ? (
            <Button onClick={() => setShowConfirmDialog(true)} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Vincular Agente
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmation AlertDialog */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar vinculação</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja vincular o usuário{' '}
            <strong>{selectedUser?.name}</strong> ao agente{' '}
            <strong>{selectedAgent?.business_name || selectedAgent?.client_name}</strong>
            {' '}(Código: {selectedAgent?.cod_agent})?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vinculando...
              </>
            ) : (
              'Confirmar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
