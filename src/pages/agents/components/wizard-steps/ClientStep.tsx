import { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Search, X, UserPlus, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { maskCPFCNPJ, maskPhone, maskCEP, unmask } from '@/lib/inputMasks';
import { useClientSearch, SearchedClient } from '../../hooks/useClientSearch';
import { useAgentCode } from '../../hooks/useAgentCode';
import type { AgentFormData, SelectedClient } from '../CreateAgentWizard';
import { toast } from 'sonner';

type ViewState = 'search' | 'selected' | 'new';

export function ClientStep() {
  const { control, watch, setValue, getValues } = useFormContext<AgentFormData>();
  const [viewState, setViewState] = useState<ViewState>('search');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  
  const { searchTerm, setSearchTerm, results, isLoading, clearSearch } = useClientSearch();
  const { code, isLoading: isLoadingCode, generateCode, clearCode } = useAgentCode();
  
  const selectedClient = watch('selected_client');
  const codAgent = watch('cod_agent');

  // Sync view state with form data
  useEffect(() => {
    if (selectedClient) {
      setViewState('selected');
    } else if (getValues('new_client')) {
      setViewState('new');
    }
  }, [selectedClient, getValues]);

  // Sync generated code with form
  useEffect(() => {
    if (code) {
      setValue('cod_agent', code);
    }
  }, [code, setValue]);

  const handleSelectClient = async (client: SearchedClient) => {
    const selected: SelectedClient = {
      id: client.id,
      name: client.name,
      business_name: client.business_name,
      email: client.email,
      phone: client.phone,
    };
    
    setValue('selected_client', selected);
    setValue('client_id', client.id);
    setValue('new_client', false);
    
    // Also pre-fill user email for the user step
    if (client.email) {
      setValue('user_email', client.email);
    }
    
    // Generate agent code
    const generatedCode = await generateCode();
    if (!generatedCode) {
      toast.error('Erro ao gerar código do agente');
    }
    
    setViewState('selected');
    clearSearch();
  };

  const handleChangeClient = () => {
    setValue('selected_client', null);
    setValue('client_id', null);
    setValue('cod_agent', '');
    clearCode();
    setViewState('search');
  };

  const handleNewClient = () => {
    setValue('new_client', true);
    setValue('selected_client', null);
    setValue('client_id', null);
    setViewState('new');
  };

  const handleCancelNewClient = () => {
    setValue('new_client', false);
    // Clear all new client fields
    setValue('client_name', '');
    setValue('client_business_name', '');
    setValue('client_federal_id', '');
    setValue('client_email', '');
    setValue('client_phone', '');
    setValue('client_zip_code', '');
    setValue('client_street', '');
    setValue('client_street_number', '');
    setValue('client_complement', '');
    setValue('client_neighborhood', '');
    setValue('client_city', '');
    setValue('client_state', '');
    setViewState('search');
  };

  const handleCepBlur = async (cep: string) => {
    const cleanCep = unmask(cep);
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setValue('client_street', data.logradouro || '');
      setValue('client_neighborhood', data.bairro || '');
      setValue('client_city', data.localidade || '');
      setValue('client_state', data.uf || '');
    } catch (error) {
      console.error('Error fetching CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Search state
  if (viewState === 'search') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Selecionar Cliente</h3>
          <p className="text-sm text-muted-foreground">
            Busque um cliente existente ou cadastre um novo
          </p>
        </div>

        {/* Search header */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome, escritório ou email..."
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
          <Button type="button" variant="outline" onClick={handleNewClient}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Cliente
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
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-center">
                Busque um cliente existente<br />
                ou clique em "Novo Cliente" para cadastrar
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <p>Nenhum cliente encontrado</p>
              <Button type="button" variant="link" onClick={handleNewClient}>
                Cadastrar novo cliente
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                <p className="text-sm text-muted-foreground px-2 py-1 mb-2">
                  {results.length} cliente(s) encontrado(s)
                </p>
                {results.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{client.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.business_name || client.email || 'Sem informação adicional'}
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

  // Selected client state
  if (viewState === 'selected' && selectedClient) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Cliente Selecionado</h3>
          <p className="text-sm text-muted-foreground">
            Confirme os dados e configure o agente
          </p>
        </div>

        {/* Selected client card */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/30">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{selectedClient.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedClient.business_name || selectedClient.email}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleChangeClient}>
            <X className="h-4 w-4 mr-1" />
            Trocar
          </Button>
        </div>

        <Separator />

        {/* Agent config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="cod_agent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código do Agente</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      {...field} 
                      readOnly 
                      className="bg-muted pr-10"
                    />
                    {isLoadingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Gerado automaticamente
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="is_closer"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">É Closer?</FormLabel>
                  <FormDescription>
                    Define se o agente atua como closer
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  }

  // New client form
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Novo Cliente</h3>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do novo cliente
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleCancelNewClient}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome */}
        <FormField
          control={control}
          name="client_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl>
                <Input placeholder="Nome do cliente" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Razão Social */}
        <FormField
          control={control}
          name="client_business_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escritório</FormLabel>
              <FormControl>
                <Input placeholder="Razão social (opcional)" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* CPF/CNPJ */}
        <FormField
          control={control}
          name="client_federal_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CPF/CNPJ</FormLabel>
              <FormControl>
                <Input
                  placeholder="000.000.000-00"
                  {...field}
                  onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* E-mail */}
        <FormField
          control={control}
          name="client_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@exemplo.com" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Telefone */}
        <FormField
          control={control}
          name="client_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone *</FormLabel>
              <FormControl>
                <Input
                  placeholder="(00) 00000-0000"
                  {...field}
                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* CEP */}
        <FormField
          control={control}
          name="client_zip_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CEP *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="00000-000"
                    {...field}
                    onChange={(e) => field.onChange(maskCEP(e.target.value))}
                    onBlur={(e) => {
                      field.onBlur();
                      handleCepBlur(e.target.value);
                    }}
                  />
                  {isLoadingCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                  )}
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        {/* Logradouro */}
        <FormField
          control={control}
          name="client_street"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Logradouro</FormLabel>
              <FormControl>
                <Input placeholder="Rua, Avenida, etc." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Número */}
        <FormField
          control={control}
          name="client_street_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número</FormLabel>
              <FormControl>
                <Input placeholder="Número" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Complemento */}
        <FormField
          control={control}
          name="client_complement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Complemento</FormLabel>
              <FormControl>
                <Input placeholder="Apt, Sala, etc." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Bairro */}
        <FormField
          control={control}
          name="client_neighborhood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro</FormLabel>
              <FormControl>
                <Input placeholder="Bairro" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Cidade */}
        <FormField
          control={control}
          name="client_city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cidade</FormLabel>
              <FormControl>
                <Input placeholder="Cidade" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Estado */}
        <FormField
          control={control}
          name="client_state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <FormControl>
                <Input placeholder="UF" maxLength={2} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
