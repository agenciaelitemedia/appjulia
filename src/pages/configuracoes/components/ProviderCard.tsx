import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone, MessageSquare, Globe, Instagram, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { QueueProvider } from '../hooks/useQueueProviders';

const providerIcons: Record<string, React.ReactNode> = {
  uazapi: <Phone className="w-5 h-5 text-green-600" />,
  waba: <MessageSquare className="w-5 h-5 text-blue-600" />,
  webchat: <Globe className="w-5 h-5 text-purple-600" />,
  instagram: <Instagram className="w-5 h-5 text-pink-600" />,
};

const providerLabels: Record<string, string> = {
  uazapi: 'UaZapi (WhatsApp)',
  waba: 'API Oficial Meta (WABA)',
  webchat: 'WebChat',
  instagram: 'Instagram',
};

interface ProviderCardProps {
  provider: QueueProvider;
  onEdit: (provider: QueueProvider) => void;
  onDelete: (provider: QueueProvider) => void;
}

export function ProviderCard({ provider, onEdit, onDelete }: ProviderCardProps) {
  const details: string[] = [];

  if (provider.provider_type === 'uazapi' && provider.evo_url) {
    details.push(`URL: ${provider.evo_url}`);
  }
  if (provider.provider_type === 'waba' && provider.waba_business_id) {
    details.push(`Business ID: ${provider.waba_business_id}`);
  }
  if (provider.provider_type === 'instagram' && provider.page_name) {
    details.push(`Página: ${provider.page_name}`);
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {providerIcons[provider.provider_type]}
            <Badge variant={provider.is_active ? 'default' : 'secondary'}>
              {provider.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(provider)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(provider)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-foreground truncate mb-1">{provider.name}</h3>
        <p className="text-xs text-muted-foreground mb-2">
          {providerLabels[provider.provider_type] || provider.provider_type}
        </p>

        {details.map((d, i) => (
          <p key={i} className="text-xs text-muted-foreground truncate">{d}</p>
        ))}
      </CardContent>
    </Card>
  );
}
