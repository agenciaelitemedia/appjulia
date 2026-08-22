/** extend/ui — primitivos visuais reaproveitados (sem edição). */
export { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export { Badge } from '@/components/ui/badge';
export { Button } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export { Skeleton } from '@/components/ui/skeleton';
export { Separator } from '@/components/ui/separator';
export { cn } from '@/lib/utils';
export { MascoteLoader } from '@/components/ui/mascote-loader';
export { getMessagePreview } from '@/lib/chat/messagePreview';
export { evaluateSla, formatRemaining, type SlaEvaluation } from '@/hooks/useChatSlaConfigs';
export { SlaBadge } from '@/components/chat/SlaBadge';

export { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
export { Label } from '@/components/ui/label';
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export { Checkbox } from '@/components/ui/checkbox';
export { ScrollArea } from '@/components/ui/scroll-area';

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
export { TeamMemberSelect } from '@/components/TeamMemberSelect';
export { useTeamByClient } from '@/hooks/useTeamByClient';
