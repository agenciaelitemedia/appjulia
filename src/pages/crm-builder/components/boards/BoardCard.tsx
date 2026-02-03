import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Settings, 
  Archive, 
  Pencil,
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
import type { CRMBoard } from '../../types';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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

interface BoardCardProps {
  board: CRMBoard;
  onClick: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function BoardCard({ board, onClick, onEdit, onArchive }: BoardCardProps) {
  const IconComponent = iconMap[board.icon] || LayoutDashboard;

  return (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-2"
      style={{ borderColor: `${board.color}40` }}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${board.color}20` }}
          >
            <IconComponent 
              className="h-6 w-6" 
              style={{ color: board.color }}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                className="text-destructive"
              >
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-lg text-foreground mb-1">
          {board.name}
        </h3>
        
        {board.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {board.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
