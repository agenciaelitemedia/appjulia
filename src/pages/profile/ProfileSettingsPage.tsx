import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Lock, Mail, Shield, Eye, EyeOff, Check, X, Camera, Building2, Phone, MapPin, Loader2, Save, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { externalDb, Client } from '@/lib/externalDb';
import { supabase } from '@/integrations/supabase/client';
import { maskCPFCNPJ, maskPhone, maskCEP, unmask } from '@/lib/inputMasks';

interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Client data state
  const [clientData, setClientData] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load client data
  useEffect(() => {
    const loadClientData = async () => {
      if (!user?.client_id) return;
      
      setIsLoadingClient(true);
      try {
        const client = await externalDb.getClient<Client>(user.client_id);
        if (client) {
          setClientData(client);
          setFormData({
            name: client.name || '',
            business_name: client.business_name || '',
            federal_id: client.federal_id || '',
            email: client.email || '',
            phone: client.phone || '',
            state: client.state || '',
            city: client.city || '',
            zip_code: client.zip_code || '',
            street: client.street || '',
            street_number: client.street_number || '',
            complement: client.complement || '',
            neighborhood: client.neighborhood || '',
          });
        }
      } catch (error: any) {
        console.error('Error loading client data:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar os dados do cliente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingClient(false);
      }
    };

    loadClientData();
  }, [user?.client_id, toast]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if form has changes
  const hasChanges = Boolean(clientData && Object.keys(formData).some(
    key => formData[key as keyof typeof formData] !== (clientData[key as keyof Client] || '')
  ));

  // Handle browser beforeunload event to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Handle masked input changes
  const handleMaskedInputChange = useCallback((field: keyof Client, value: string, maskFn: (v: string) => string) => {
    setFormData(prev => ({ ...prev, [field]: maskFn(value) }));
  }, []);

  const handleInputChange = (field: keyof Client, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Search CEP via ViaCEP API
  const searchCep = async () => {
    const cep = unmask(formData.zip_code || '');
    if (cep.length !== 8) {
      toast({
        title: 'CEP inválido',
        description: 'Digite um CEP válido com 8 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data: ViaCEPResponse = await response.json();

      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'Não foi possível encontrar o endereço para este CEP.',
          variant: 'destructive',
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        city: data.localidade,
        state: data.uf,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
      }));

      toast({
        title: 'Endereço encontrado',
        description: `${data.logradouro ? data.logradouro + ', ' : ''}${data.bairro ? data.bairro + ' - ' : ''}${data.localidade} - ${data.uf}`,
      });
    } catch (error) {
      console.error('Error searching CEP:', error);
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o CEP. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Handle CEP input change
  const handleCepChange = useCallback((value: string) => {
    const masked = maskCEP(value);
    setFormData(prev => ({ ...prev, zip_code: masked }));
  }, []);

  // Auto-search CEP on blur when it has 8 digits
  const handleCepBlur = useCallback(() => {
    const cep = unmask(formData.zip_code || '');
    if (cep.length === 8 && !isSearchingCep) {
      searchCep();
    }
  }, [formData.zip_code, isSearchingCep, searchCep]);

  // Handle photo upload
  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.client_id) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo inválido',
        description: 'Apenas imagens JPEG, PNG e WebP são permitidas.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `client_${user.client_id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      const photoUrl = urlData.publicUrl;
      await externalDb.updateClient(user.client_id, { photo: photoUrl });
      setClientData(prev => prev ? { ...prev, photo: photoUrl } : null);

      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi atualizada com sucesso.',
      });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Erro ao enviar foto',
        description: error.message || 'Não foi possível enviar a foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle client data save
  const handleSaveClient = async () => {
    if (!user?.client_id || !hasChanges) return;

    setIsSavingClient(true);
    try {
      const updatedClient = await externalDb.updateClient<Client>(user.client_id, formData);
      setClientData(updatedClient);
      
      toast({
        title: 'Dados salvos',
        description: 'Os dados do cliente foram atualizados com sucesso.',
      });
    } catch (error: any) {
      console.error('Error saving client data:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingClient(false);
    }
  };

  // Password validation
  const passwordValidation = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    matches: newPassword === confirmPassword && newPassword.length > 0,
  };

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast({
        title: 'Senha inválida',
        description: 'Verifique os requisitos da senha.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentPassword) {
      toast({
        title: 'Senha atual obrigatória',
        description: 'Digite sua senha atual para confirmar a alteração.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      await externalDb.changePassword(user?.id || 0, currentPassword, newPassword);

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso.',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Não foi possível alterar a senha. Verifique sua senha atual.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-green-600' : 'text-muted-foreground'}`}>
      {valid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações do Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile & Client Data Card - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados do Perfil
            </CardTitle>
            <CardDescription>Suas informações pessoais e da empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingClient ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div 
                    className="relative group cursor-pointer"
                    onClick={handlePhotoClick}
                  >
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={clientData?.photo || undefined} alt={user?.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                        {user?.name ? getInitials(user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingPhoto ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{user?.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span className="capitalize">{user?.role}</span>
                      {user?.cod_agent && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          Agente: {user.cod_agent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Client Data Form */}
                {user?.client_id ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Dados do Cliente
                    </h4>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="client-name">Nome</Label>
                        <Input
                          id="client-name"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Nome do responsável"
                          maxLength={100}
                        />
                      </div>

                      {/* Business Name */}
                      <div className="space-y-2">
                        <Label htmlFor="business-name">Razão Social</Label>
                        <Input
                          id="business-name"
                          value={formData.business_name || ''}
                          onChange={(e) => handleInputChange('business_name', e.target.value)}
                          placeholder="Razão social da empresa"
                          maxLength={100}
                        />
                      </div>

                      {/* Federal ID */}
                      <div className="space-y-2">
                        <Label htmlFor="federal-id">CPF/CNPJ</Label>
                        <Input
                          id="federal-id"
                          value={formData.federal_id || ''}
                          onChange={(e) => handleMaskedInputChange('federal_id', e.target.value, maskCPFCNPJ)}
                          placeholder="000.000.000-00 ou 00.000.000/0000-00"
                          maxLength={18}
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="client-email" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          E-mail
                        </Label>
                        <Input
                          id="client-email"
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="email@empresa.com"
                          maxLength={100}
                        />
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label htmlFor="client-phone" className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Telefone
                        </Label>
                        <Input
                          id="client-phone"
                          value={formData.phone || ''}
                          onChange={(e) => handleMaskedInputChange('phone', e.target.value, maskPhone)}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>

                      {/* Zip Code with search */}
                      <div className="space-y-2">
                        <Label htmlFor="client-zipcode" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          CEP
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="client-zipcode"
                            value={formData.zip_code || ''}
                            onChange={(e) => handleCepChange(e.target.value)}
                            onBlur={handleCepBlur}
                            placeholder="00000-000"
                            maxLength={9}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={searchCep}
                            disabled={isSearchingCep || unmask(formData.zip_code || '').length !== 8}
                            title="Buscar endereço pelo CEP"
                          >
                            {isSearchingCep ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Street */}
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="client-street">Logradouro</Label>
                        <Input
                          id="client-street"
                          value={formData.street || ''}
                          onChange={(e) => handleInputChange('street', e.target.value)}
                          placeholder="Rua, Avenida, etc."
                          maxLength={150}
                        />
                      </div>

                      {/* Street Number */}
                      <div className="space-y-2">
                        <Label htmlFor="client-street-number">Número</Label>
                        <Input
                          id="client-street-number"
                          value={formData.street_number || ''}
                          onChange={(e) => handleInputChange('street_number', e.target.value)}
                          placeholder="123"
                          maxLength={10}
                        />
                      </div>

                      {/* Complement */}
                      <div className="space-y-2">
                        <Label htmlFor="client-complement">Complemento</Label>
                        <Input
                          id="client-complement"
                          value={formData.complement || ''}
                          onChange={(e) => handleInputChange('complement', e.target.value)}
                          placeholder="Apto, Sala, etc."
                          maxLength={50}
                        />
                      </div>

                      {/* Neighborhood */}
                      <div className="space-y-2">
                        <Label htmlFor="client-neighborhood">Bairro</Label>
                        <Input
                          id="client-neighborhood"
                          value={formData.neighborhood || ''}
                          onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                          placeholder="Nome do bairro"
                          maxLength={100}
                        />
                      </div>

                      {/* City */}
                      <div className="space-y-2">
                        <Label htmlFor="client-city">Cidade</Label>
                        <Input
                          id="client-city"
                          value={formData.city || ''}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          placeholder="Nome da cidade"
                          maxLength={50}
                        />
                      </div>

                      {/* State */}
                      <div className="space-y-2">
                        <Label htmlFor="client-state">Estado</Label>
                        <Input
                          id="client-state"
                          value={formData.state || ''}
                          onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                          placeholder="UF"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={handleSaveClient}
                        disabled={!hasChanges || isSavingClient}
                        className="min-w-[150px]"
                      >
                        {isSavingClient ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Salvar Alterações
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não há dados de cliente associados a esta conta.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card - Takes 1 column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Password Requirements */}
              {newPassword.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-medium">Requisitos:</p>
                  <ValidationItem valid={passwordValidation.minLength} text="Mínimo 8 caracteres" />
                  <ValidationItem valid={passwordValidation.hasUppercase} text="Letra maiúscula" />
                  <ValidationItem valid={passwordValidation.hasLowercase} text="Letra minúscula" />
                  <ValidationItem valid={passwordValidation.hasNumber} text="Número" />
                  <ValidationItem valid={passwordValidation.matches} text="Senhas coincidem" />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={!isPasswordValid || !currentPassword || isChangingPassword}
              >
                {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
