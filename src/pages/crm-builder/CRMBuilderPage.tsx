import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { BoardGrid } from './components/boards/BoardGrid';
import { CreateBoardDialog } from './components/boards/CreateBoardDialog';
import { useCRMBoards } from './hooks/useCRMBoards';
import type { CRMBoard, CRMBoardFormData } from './types';
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

export default function CRMBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const codAgent = user?.cod_agent?.toString() || '';

  const {
    boards,
    isLoading,
    fetchBoards,
    createBoard,
    updateBoard,
    archiveBoard,
  } = useCRMBoards({ codAgent });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<CRMBoard | null>(null);
  const [archivingBoard, setArchivingBoard] = useState<CRMBoard | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCreateBoard = async (data: CRMBoardFormData) => {
    return await createBoard(data);
  };

  const handleEditBoard = async (data: CRMBoardFormData) => {
    if (!editingBoard) return null;
    const success = await updateBoard(editingBoard.id, data);
    if (success) {
      setEditingBoard(null);
      return editingBoard;
    }
    return null;
  };

  const handleArchiveBoard = async () => {
    if (!archivingBoard) return;
    await archiveBoard(archivingBoard.id);
    setArchivingBoard(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBoards();
    setIsRefreshing(false);
  };

  const handleBoardClick = (board: CRMBoard) => {
    navigate(`/crm-builder/${board.id}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM Builder</h1>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie seus pipelines de vendas
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Boards Grid */}
      <BoardGrid
        boards={boards}
        isLoading={isLoading}
        onBoardClick={handleBoardClick}
        onBoardEdit={setEditingBoard}
        onBoardArchive={setArchivingBoard}
        onCreateClick={() => setIsCreateDialogOpen(true)}
      />

      {/* Create Board Dialog */}
      <CreateBoardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateBoard}
      />

      {/* Edit Board Dialog */}
      <CreateBoardDialog
        open={!!editingBoard}
        onOpenChange={(open) => !open && setEditingBoard(null)}
        onSubmit={handleEditBoard}
        editBoard={editingBoard}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archivingBoard} onOpenChange={(open) => !open && setArchivingBoard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Board</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar o board "{archivingBoard?.name}"? 
              Todos os deals serão mantidos, mas o board não aparecerá mais na listagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveBoard}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
