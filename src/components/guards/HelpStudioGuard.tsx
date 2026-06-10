import { Navigate } from 'react-router-dom';
import { useHelpStudioAccess } from '@/hooks/useHelpStudioAccess';

/**
 * Guarda das rotas do Studio da Central de Ajuda.
 * Acesso permitido somente para admin ou usuários vinculados na aba Permissões.
 */
export function HelpStudioGuard({ children }: { children: React.ReactNode }) {
  const { canAccessStudio, isLoading } = useHelpStudioAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        Verificando acesso…
      </div>
    );
  }

  if (!canAccessStudio) {
    return <Navigate to="/ajuda" replace />;
  }

  return <>{children}</>;
}