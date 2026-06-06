import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUrl } from '@/lib/chat/linkPreview';

export interface LinkPreviewData {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  domain?: string | null;
}

async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const { data, error } = await supabase.functions.invoke('link-preview', {
    body: { url },
  });
  if (error) return null;
  if (!data || (data as { error?: string }).error) {
    const d = data as LinkPreviewData | null;
    if (d && (d.title || d.image || d.description)) return d;
    return null;
  }
  return data as LinkPreviewData;
}

export function useLinkPreview(rawUrl: string | null | undefined, enabled = true) {
  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  return useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => fetchLinkPreview(url as string),
    enabled: !!url && enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}