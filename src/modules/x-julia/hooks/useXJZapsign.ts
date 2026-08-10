/**
 * Wizard ZapSign: confirmar token, subir modelo (.docx) e mapear variáveis
 * para os campos de dados do caso jurídico.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';

export interface XJZapsignVariable {
  variable: string;
  input_type?: string;
  label?: string;
  required?: boolean;
  order?: number;
}

export interface XJZapsignTemplate {
  id: string;
  client_id: string;
  case_id: string;
  agent_id: string | null;
  template_token: string;
  template_name: string;
  folder_path: string;
  docx_file_url: string | null;
  variables: XJZapsignVariable[];
  field_mapping: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const KEY = ['x-julia', 'zapsign-template'];

export function useXJZapsignTemplate(caseId?: string | null) {
  return useQuery<XJZapsignTemplate | null>({
    queryKey: [...KEY, caseId ?? 'none'],
    enabled: !!caseId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `xj-zapsign?case_id=${encodeURIComponent(String(caseId))}`,
        { method: 'GET' },
      );
      if (error) return null;
      return (data as any)?.template ?? null;
    },
  });
}

export function useXJZapsignMutations() {
  const queryClient = useQueryClient();
  const invalidate = (caseId?: string) => queryClient.invalidateQueries({ queryKey: caseId ? [...KEY, caseId] : KEY });

  const validateToken = useMutation<{ ok: boolean; error?: string }, any, { token: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-zapsign', {
        method: 'POST',
        body: { action: 'validate_token', ...input },
      });
      if (error) throw new Error(error.message || 'Não foi possível contatar o serviço do ZapSign. Tente novamente.');
      return data as { ok: boolean; error?: string };
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao testar o token do ZapSign'),
  });

  const uploadTemplate = useMutation<
    XJZapsignTemplate,
    any,
    {
      client_id: string;
      client_name: string;
      case_id: string;
      agent_id?: string | null;
      case_name: string;
      base64_docx: string;
      token?: string;
    }
  >({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-zapsign', {
        method: 'POST',
        body: { action: 'upload_template', ...input },
      });
      if (error) {
        const detail = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).template as XJZapsignTemplate;
    },
    onSuccess: (template) => {
      invalidate(template.case_id);
      toast.success('Modelo enviado ao ZapSign');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao subir o modelo no ZapSign'),
  });

  const saveMapping = useMutation<
    XJZapsignTemplate,
    any,
    { id: string; case_id: string; field_mapping: Record<string, string> }
  >({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-zapsign', {
        method: 'POST',
        body: { action: 'save_mapping', id: input.id, field_mapping: input.field_mapping },
      });
      if (error) throw new Error(error.message || 'Não foi possível salvar o mapeamento agora. Tente novamente.');
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).template as XJZapsignTemplate;
    },
    onSuccess: (template) => {
      invalidate(template.case_id);
      toast.success('Mapeamento de variáveis salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar o mapeamento'),
  });

  const testMapping = useMutation<
    {
      ok: boolean;
      unmapped?: string[];
      filled?: Array<{ de: string; para: string }>;
      sign_url?: string | null;
      document_url?: string | null;
      error?: string;
    },
    any,
    { id: string; field_mapping: Record<string, string>; token?: string }
  >({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-zapsign', {
        method: 'POST',
        body: { action: 'test_mapping', ...input },
      });
      if (error) {
        const detail = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message || 'Não foi possível testar o modelo agora.');
      }
      return data as any;
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar o documento de teste'),
  });

  const deactivateTemplate = useMutation<XJZapsignTemplate, any, { id: string; case_id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('xj-zapsign', {
        method: 'POST',
        body: { action: 'deactivate_template', id: input.id },
      });
      if (error) throw new Error(error.message || 'Não foi possível remover o modelo agora.');
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).template as XJZapsignTemplate;
    },
    onSuccess: (template) => {
      invalidate(template.case_id);
      toast.success('Modelo removido do caso');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover o modelo'),
  });

  return { validateToken, uploadTemplate, saveMapping, testMapping, deactivateTemplate };
}
