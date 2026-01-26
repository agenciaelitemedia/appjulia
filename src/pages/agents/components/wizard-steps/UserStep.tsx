import { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Search, X, UserPlus, User, ChevronRight, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUserSearch, SearchedUser } from '../../hooks/useUserSearch';
import { externalDb } from '@/lib/externalDb';
import { toast } from 'sonner';
import type { AgentFormData, SelectedUser } from '../CreateAgentWizard';

type ViewState = 'search' | 'selected' | 'new';
type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export function UserStep() {
  const { control, watch, setValue, getValues, setError, clearErrors } = useFormContext<AgentFormData>();
  const [viewState, setViewState] = useState<ViewState>('search');
  const [emailStatus, setEmailStatus] = useState<ValidationStatus>('idle');
  
  const { searchTerm, setSearchTerm, results, isLoading, clearSearch } = useUserSearch();
  
  const selectedUser = watch('selected_user');
  const clientEmail = watch('client_email');
  const selectedClient = watch('selected_client');

  // Sync view state with form data
  useEffect(() => {
    if (selectedUser) {
      setViewState('selected');
    } else if (getValues('new_user')) {
      setViewState('new');
    }
  }, [selectedUser, getValues]);

  // Pre-fill user email from client (existing or new)
  useEffect(() => {
    const email = clientEmail || selectedClient?.email;
    if (email && !getValues('user_email')) {
      setValue('user_email', email);
    }
  }, [clientEmail, selectedClient, setValue, getValues]);

  const handleSelectUser = (user: SearchedUser) => {
    const selected: SelectedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    
    setValue('selected_user', selected);
    setValue('user_id', user.id);
    setValue('new_user', false);
    
    setViewState('selected');
    clearSearch();
  };

  const handleChangeUser = () => {
    setValue('selected_user', null);
    setValue('user_id', null);
    setViewState('search');
  };

  const handleNewUser = () => {
    setValue('new_user', true);
    setValue('selected_user', null);
    setValue('user_id', null);
    
    // Pre-fill email from client
    const email = clientEmail || selectedClient?.email;
    if (email) {
      setValue('user_email', email);
    }
    
    setViewState('new');
  };

  const handleCancelNewUser = () => {
    setValue('new_user', false);
    setValue('user_name', '');
    setValue('user_email', '');
    setEmailStatus('idle');
    clearErrors('user_email');
    setViewState('search');
  };

  const handleEmailBlur = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      clearErrors('user_email');
      return;
    }

    setEmailStatus('checking');
    try {
      const result = await externalDb.checkUserEmailExists(email);
      if (result.exists) {
        setEmailStatus('invalid');
        setError('user_email', { 
          type: 'manual', 
          message: 'E-mail já cadastrado no sistema' 
        });
        toast.error('E-mail já cadastrado no sistema');
      } else {
        setEmailStatus('valid');
        clearErrors('user_email');
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailStatus('idle');
    }
  };

  // Search state
  if (viewState === 'search') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Vincular Usuário</h3>
          <p className="text-sm text-muted-foreground">
            Busque um usuário existente ou cadastre um novo para operar o agente
          </p>
        </div>

        {/* Search header */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={handleNewUser}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Results area */}
        <div className="border rounded-lg min-h-[300px]">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.length < 3 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-center">
                Busque um usuário existente<br />
                ou clique em "Novo Usuário" para cadastrar
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <p>Nenhum usuário encontrado</p>
              <Button type="button" variant="link" onClick={handleNewUser}>
                Cadastrar novo usuário
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                <p className="text-sm text-muted-foreground px-2 py-1 mb-2">
                  {results.length} usuário(s) encontrado(s)
                </p>
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    );
  }

  // Selected user state
  if (viewState === 'selected' && selectedUser) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Usuário Selecionado</h3>
          <p className="text-sm text-muted-foreground">
            Este usuário terá acesso para operar o agente
          </p>
        </div>

        {/* Selected user card */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/30">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{selectedUser.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {selectedUser.email}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleChangeUser}>
            <X className="h-4 w-4 mr-1" />
            Trocar
          </Button>
        </div>
      </div>
    );
  }

  // New user form
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Novo Usuário</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre um novo usuário para operar o agente
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleCancelNewUser}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-md">
        {/* Nome */}
        <FormField
          control={control}
          name="user_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl>
                <Input placeholder="Nome do usuário" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={control}
          name="user_email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>E-mail *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input 
                    type="email" 
                    placeholder="email@exemplo.com" 
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setEmailStatus('idle');
                      clearErrors('user_email');
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      handleEmailBlur(e.target.value);
                    }}
                    className={fieldState.error ? 'border-destructive' : ''}
                  />
                  {emailStatus === 'checking' && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {emailStatus === 'valid' && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {emailStatus === 'invalid' && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                  )}
                </div>
              </FormControl>
              {(clientEmail || selectedClient?.email) && (
                <p className="text-xs text-muted-foreground">
                  Pré-preenchido com o e-mail do cliente
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
