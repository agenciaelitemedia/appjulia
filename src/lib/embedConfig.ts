import { supabase } from "@/integrations/supabase/client";

export interface ModuleEmbedRow {
  id: string;
  code: string;
  name: string | null;
  url_template: string;
  auth_mode: 'simple' | 'signed';
  hmac_ttl_seconds: number;
  iframe_sandbox: string;
  iframe_referrer_policy: string;
  open_in_new_tab: boolean;
  allowed_origins: string[] | null;
  variables: Record<string, unknown>;
  is_active: boolean;
  has_secret: boolean;
}

export interface ResolvedEmbed {
  url: string;
  name: string;
  open_in_new_tab: boolean;
  iframe_sandbox: string;
  iframe_referrer_policy: string;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('embed-config', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data as T;
}

export const embedConfig = {
  list: () => call<ModuleEmbedRow[]>({ action: 'list' }),
  upsert: (embed: Partial<ModuleEmbedRow> & { hmac_secret?: string }) =>
    call<{ id: string; ok: boolean }>({ action: 'upsert', embed }),
  remove: (id: string) => call<{ ok: boolean }>({ action: 'delete', id }),
  resolve: (code: string, externalUserId?: number) =>
    call<ResolvedEmbed>({ action: 'resolve', code, external_user_id: externalUserId }),
};