import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  isLoading?: boolean;
}

export function ConnectionStatusBadge({ status, isLoading }: ConnectionStatusBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Verificando...
      </Badge>
    );
  }

  switch (status) {
    case 'connected':
      return (
        <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-white">
          <Wifi className="w-3 h-3" />
          Conectado
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="w-3 h-3" />
          Desconectado
        </Badge>
      );
    case 'no_config':
    default:
      return (
        <Badge className="gap-1 bg-amber-500 hover:bg-amber-600 text-black">
          <AlertCircle className="w-3 h-3" />
          Sem conexão
        </Badge>
      );
  }
}
