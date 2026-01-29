import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { checkBusinessHours } from '@/lib/businessHoursUtils';

interface BusinessHoursBadgeProps {
  settings: Record<string, unknown> | null;
  showLabel?: boolean;
}

export function BusinessHoursBadge({ settings, showLabel = true }: BusinessHoursBadgeProps) {
  const result = checkBusinessHours(settings);

  if (!result.enabled) {
    // 24h - no time restriction
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {showLabel && '24h'}
      </Badge>
    );
  }

  if (result.isWithinHours) {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {showLabel && 'Aberto'}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <XCircle className="h-3 w-3" />
      {showLabel && 'Fechado'}
    </Badge>
  );
}
