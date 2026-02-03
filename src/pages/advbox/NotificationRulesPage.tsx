import { useEffect, useState } from 'react';
import { useAdvboxIntegration } from '@/hooks/advbox/useAdvboxIntegration';
import { useNotificationRules } from '@/hooks/advbox/useNotificationRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { 
  Bell, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  Scale,
  MessageSquare,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { AdvboxAgentSelect } from '@/components/advbox/AdvboxAgentSelect';
import { RuleEditorDialog } from '@/components/advbox/RuleEditorDialog';
import { Link } from 'react-router-dom';
import type { AdvboxNotificationRule, AdvboxNotificationRuleFormData } from '@/types/advbox';
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

export default function NotificationRulesPage() {
  const { integration, loadIntegration, isLoading: isLoadingIntegration } = useAdvboxIntegration();
  const { rules, isLoading: isLoadingRules, isSaving, loadRules, saveRule, toggleRule, deleteRule } = useNotificationRules();

  const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AdvboxNotificationRule | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<AdvboxNotificationRule | null>(null);

  // Load integration and rules when agent changes
  useEffect(() => {
    if (selectedAgentId) {
      loadIntegration(selectedAgentId);
      loadRules(selectedAgentId);
    }
  }, [selectedAgentId, loadIntegration, loadRules]);

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsEditorOpen(true);
  };

  const handleEditRule = (rule: AdvboxNotificationRule) => {
    setEditingRule(rule);
    setIsEditorOpen(true);
  };

  const handleSaveRule = async (data: AdvboxNotificationRuleFormData) => {
    if (!selectedAgentId || !integration?.id) return false;
    const success = await saveRule(selectedAgentId, integration.id, data, editingRule?.id);
    if (success) {
      setIsEditorOpen(false);
      setEditingRule(null);
    }
    return success;
  };

  const handleToggleRule = async (rule: AdvboxNotificationRule) => {
    await toggleRule(rule.id, !rule.is_active);
  };

  const handleDeleteRule = async () => {
    if (!deleteConfirmRule) return;
    await deleteRule(deleteConfirmRule.id);
    setDeleteConfirmRule(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLoading = isLoadingIntegration || isLoadingRules;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/advbox">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Regras de Notificação</h1>
            <p className="text-muted-foreground">Configure alertas automáticos de movimentações</p>
          </div>
        </div>
      </div>

      {/* Agent Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Agente</CardTitle>
          <CardDescription>Escolha o agente para gerenciar as regras</CardDescription>
        </CardHeader>
        <CardContent>
          <AdvboxAgentSelect
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
            placeholder="Selecione um agente..."
          />
        </CardContent>
      </Card>

      {/* No Agent Selected */}
      {!selectedAgentId && (
        <Card>
          <CardContent className="p-12 text-center">
            <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione um Agente</h3>
            <p className="text-muted-foreground">
              Escolha um agente acima para gerenciar suas regras de notificação
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {selectedAgentId && isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {/* No Integration */}
      {selectedAgentId && !isLoading && !integration && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Integração não configurada</h3>
            <p className="text-muted-foreground mb-4">
              Configure a integração com Advbox antes de criar regras de notificação
            </p>
            <Button asChild>
              <Link to="/advbox">Configurar Integração</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {selectedAgentId && !isLoading && integration && (
        <>
          {/* Create Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={handleCreateRule}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Regra
            </Button>
          </div>

          {/* Empty State */}
          {rules.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma regra configurada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira regra para receber notificações automáticas
                </p>
                <Button onClick={handleCreateRule}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Regra
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rules Grid */}
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{rule.rule_name}</h3>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Badge variant="outline">
                          {rule.send_to === 'cliente' ? 'Cliente' : 
                           rule.send_to === 'advogado' ? 'Advogado' : 'Ambos'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {rule.process_phases?.map((phase) => (
                          <Badge key={phase} variant="secondary" className="text-xs">
                            {phase}
                          </Badge>
                        ))}
                        {rule.event_types?.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{rule.notifications_sent || 0} enviadas</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Último: {formatDate(rule.last_triggered || null)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Cooldown: {rule.cooldown_minutes}min</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleRule(rule)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => setDeleteConfirmRule(rule)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Rule Editor Dialog */}
      <RuleEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        rule={editingRule}
        onSave={handleSaveRule}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmRule} onOpenChange={() => setDeleteConfirmRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a regra "{deleteConfirmRule?.rule_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
