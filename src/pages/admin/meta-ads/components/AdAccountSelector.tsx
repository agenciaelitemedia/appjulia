import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, ChevronRight } from 'lucide-react';
import type { AdAccount } from '../types';

interface AdAccountSelectorProps {
  accounts: AdAccount[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const ACCOUNT_STATUS_MAP: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  1: { label: 'Ativa', variant: 'default' },
  2: { label: 'Desativada', variant: 'secondary' },
  3: { label: 'Não configurada', variant: 'outline' },
  7: { label: 'Pendente', variant: 'outline' },
  8: { label: 'Revisão pendente', variant: 'outline' },
  9: { label: 'Em análise', variant: 'outline' },
  100: { label: 'Cancelada', variant: 'destructive' },
  101: { label: 'Desativada', variant: 'destructive' },
};

export function AdAccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  onRefresh,
  isLoading,
  disabled,
}: AdAccountSelectorProps) {
  const getStatusInfo = (status: number) => {
    return ACCOUNT_STATUS_MAP[status] || { label: `Status ${status}`, variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Contas de Anúncios
            </CardTitle>
            <CardDescription>
              Selecione uma conta para visualizar campanhas e métricas
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading || disabled}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {disabled ? (
              <p>Autentique-se para ver suas contas de anúncios</p>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Buscando contas...</span>
              </div>
            ) : (
              <p>Clique em "Atualizar" para buscar suas contas</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const statusInfo = getStatusInfo(account.account_status);
              const isSelected = selectedAccountId === account.id;
              
              return (
                <button
                  key={account.id}
                  onClick={() => onSelect(account.id)}
                  disabled={isLoading}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>ID: {account.account_id}</span>
                        <span>{account.currency}</span>
                        {account.business_name && (
                          <span className="text-xs">{account.business_name}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
