import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KbCategory {
  id: string;
  client_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
}

export interface KbArticle {
  id: string;
  client_id: string;
  cod_agent: string | null;
  category_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  tags: string[];
  keywords: string[];
  is_published: boolean;
  view_count: number;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export function useKbCategories(clientId: string | null) {
  return useQuery({
    queryKey: ['kb-categories', clientId],
    queryFn: async (): Promise<KbCategory[]> => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('chat_kb_categories')
        .select('*')
        .eq('client_id', clientId)
        .order('position');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
}

export function useKbArticles(clientId: string | null, search?: string) {
  return useQuery({
    queryKey: ['kb-articles', clientId, search],
    queryFn: async (): Promise<KbArticle[]> => {
      if (!clientId) return [];
      let q = supabase
        .from('chat_kb_articles')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      if (search && search.trim()) {
        const s = search.trim();
        q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%,content.ilike.%${s}%`);
      }
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
}

export function useSaveKbArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (article: Partial<KbArticle> & { client_id: string; title: string; content: string }) => {
      if (article.id) {
        const { data, error } = await supabase
          .from('chat_kb_articles')
          .update(article)
          .eq('id', article.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('chat_kb_articles').insert(article).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-articles'] });
      toast.success('Artigo salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteKbArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_kb_articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-articles'] });
      toast.success('Artigo removido');
    },
  });
}

export function useIncrementKbUsage() {
  return useMutation({
    mutationFn: async ({ id, field }: { id: string; field: 'view_count' | 'use_count' }) => {
      const { data: row } = await supabase.from('chat_kb_articles').select(field).eq('id', id).maybeSingle();
      if (!row) return;
      const current = (row as Record<string, number>)[field] || 0;
      await supabase.from('chat_kb_articles').update({ [field]: current + 1 }).eq('id', id);
    },
  });
}
