import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Lock, Mail, Shield, Eye, EyeOff, Check, X, Camera, Building2, Phone, MapPin, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { externalDb, Client } from '@/lib/externalDb';
import { supabase } from '@/integrations/supabase/client';

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
  const hasChanges = clientData && Object.keys(formData).some(
    key => formData[key as keyof typeof formData] !== (clientData[key as keyof Client] || '')
  );

  // Handle photo upload
  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.client_id) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo inválido',
        description: 'Apenas imagens JPEG, PNG e WebP são permitidas.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
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

      // Update client photo in database
      await externalDb.updateClient(user.client_id, { photo: photoUrl });
      
      // Update local state
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
      // Reset input
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

  const handleInputChange = (field: keyof Client, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações do Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Avatar & Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Foto de Perfil
            </CardTitle>
            <CardDescription>Clique na foto para alterar</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {/* Avatar with upload overlay */}
            <div 
              className="relative group cursor-pointer"
              onClick={handlePhotoClick}
            >
              <Avatar className="h-32 w-32">
                <AvatarImage src={clientData?.photo || undefined} alt={user?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingPhoto ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="text-center">
              <h3 className="font-semibold text-lg">{user?.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
            </div>

            <Separator className="w-full" />

            {/* User Info (read-only) */}
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{user?.role}</span>
              </div>
              {user?.cod_agent && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Agente: {user.cod_agent}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
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
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">Requisitos da senha:</p>
                  <ValidationItem valid={passwordValidation.minLength} text="Mínimo de 8 caracteres" />
                  <ValidationItem valid={passwordValidation.hasUppercase} text="Pelo menos uma letra maiúscula" />
                  <ValidationItem valid={passwordValidation.hasLowercase} text="Pelo menos uma letra minúscula" />
                  <ValidationItem valid={passwordValidation.hasNumber} text="Pelo menos um número" />
                  <ValidationItem valid={passwordValidation.matches} text="As senhas coincidem" />
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

      {/* Client Data Section - Only show if user has client_id */}
      {user?.client_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
            <CardDescription>Informações cadastrais da empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingClient ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      onChange={(e) => handleInputChange('federal_id', e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={20}
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
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      maxLength={20}
                    />
                  </div>

                  {/* State */}
                  <div className="space-y-2">
                    <Label htmlFor="client-state" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Estado
                    </Label>
                    <Input
                      id="client-state"
                      value={formData.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                      placeholder="UF"
                      maxLength={2}
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

                  {/* Zip Code */}
                  <div className="space-y-2">
                    <Label htmlFor="client-zipcode">CEP</Label>
                    <Input
                      id="client-zipcode"
                      value={formData.zip_code || ''}
                      onChange={(e) => handleInputChange('zip_code', e.target.value)}
                      placeholder="00000-000"
                      maxLength={20}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
