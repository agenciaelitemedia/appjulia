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
export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
export { cn } from '@/lib/utils';
export { MascoteLoader } from '@/components/ui/mascote-loader';
export { getMessagePreview } from '@/modules/julia-chat/chat/lib/messagePreview';
export { evaluateSla, formatRemaining, type SlaEvaluation } from '@/hooks/useChatSlaConfigs';
export { SlaBadge } from '@/modules/julia-chat/chat/components/SlaBadge';

export { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
export { Label } from '@/components/ui/label';
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export { Checkbox } from '@/components/ui/checkbox';
export { ScrollArea } from '@/components/ui/scroll-area';

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
export { TeamMemberSelect } from '@/components/TeamMemberSelect';
export { useTeamByClient } from '@/hooks/useTeamByClient';

export {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
export {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
export { Textarea } from '@/components/ui/textarea';
export { TransferDialog } from '@/modules/julia-chat/chat/components/TransferDialog';
export { ReturnToQueueDialog } from '@/modules/julia-chat/chat/components/ReturnToQueueDialog';
export { ContactCampaignCard } from '@/modules/julia-chat/chat/components/ContactCampaignCard';
export { useChatAssignedCountsByMember } from '@/hooks/useChatAssignedCountsByMember';
