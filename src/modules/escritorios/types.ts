export interface OfficeRecord {
  id: string;
  client_id: number;
  owner_user_id: number | null;
  office_name: string;
  business_name: string | null;
  federal_id: string | null;
  email: string | null;
  phone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan_id: number | null;
  plan_name: string | null;
  leads_limit: number | null;
  due_day: number | null;
  expires_at: string | null;
  modules: string[];
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfficeFormData {
  // Escritório (cliente)
  client_id: number | null;
  is_new_client: boolean;
  office_name: string;
  business_name: string;
  federal_id: string;
  email: string;
  phone: string;
  zip_code: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  // Usuário titular
  is_new_user: boolean;
  user_id: number | null;
  user_name: string;
  user_email: string;
  // Plano
  plan_id: string;
  leads_limit: string;
  due_day: string;
  expires_at: string;
  // Módulos liberados
  modules: string[];
  notes: string;
}

export interface OfficePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function emptyOfficeForm(): OfficeFormData {
  return {
    client_id: null,
    is_new_client: true,
    office_name: '',
    business_name: '',
    federal_id: '',
    email: '',
    phone: '',
    zip_code: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_new_user: true,
    user_id: null,
    user_name: '',
    user_email: '',
    plan_id: '',
    leads_limit: '',
    due_day: '10',
    expires_at: '',
    modules: [],
    notes: '',
  };
}