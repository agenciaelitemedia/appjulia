import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HelpCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpPost {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  content: any;
  content_html: string | null;
  cover_image_url: string | null;
  status: string;
  is_featured: boolean;
  featured_order: number;
  tags: string[];
  view_count: number;
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const HELP_MEDIA_BUCKET = 'chat-media';
export const HELP_MEDIA_PREFIX = 'help';

export function slugifyHelpTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

/** Upload de imagem/vídeo para o storage. Retorna URL pública. */
export async function uploadHelpMedia(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${HELP_MEDIA_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage
    .from(HELP_MEDIA_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(HELP_MEDIA_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ---------- Categorias ----------

export function useHelpCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['help-categories', includeInactive],
    queryFn: async (): Promise<HelpCategory[]> => {
      let q = supabase.from('help_categories').select('*').order('position');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as HelpCategory[];
    },
  });
}

export function useSaveHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<HelpCategory> & { name: string }) => {
      if (cat.id) {
        const { id, created_at, updated_at, ...patch } = cat as any;
        const { error } = await supabase.from('help_categories').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('help_categories').insert(cat as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-categories'] });
      toast.success('Categoria salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('help_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-categories'] });
      qc.invalidateQueries({ queryKey: ['help-posts'] });
      toast.success('Categoria removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Posts (admin) ----------

export function useHelpPostsAdmin(filters?: { search?: string; categoryId?: string; status?: string }) {
  return useQuery({
    queryKey: ['help-posts', 'admin', filters],
    queryFn: async (): Promise<HelpPost[]> => {
      let q = supabase.from('help_posts').select('*').order('updated_at', { ascending: false });
      if (filters?.categoryId && filters.categoryId !== 'all') q = q.eq('category_id', filters.categoryId);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters?.search?.trim()) {
        const s = filters.search.trim();
        q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%`);
      }
      const { data, error } = await q.limit(300);
      if (error) throw error;
      return (data || []) as HelpPost[];
    },
  });
}

export function useHelpPostById(id: string | undefined) {
  return useQuery({
    queryKey: ['help-post', id],
    queryFn: async (): Promise<HelpPost | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from('help_posts').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as HelpPost | null;
    },
    enabled: !!id,
  });
}

export function useSaveHelpPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<HelpPost> & { title: string }): Promise<HelpPost> => {
      const payload: any = { ...post };
      delete payload.created_at;
      delete payload.updated_at;
      if (!payload.slug) payload.slug = slugifyHelpTitle(post.title);
      if (payload.status === 'published' && !payload.published_at) {
        payload.published_at = new Date().toISOString();
      }
      if (post.id) {
        const { id, ...patch } = payload;
        const { data, error } = await supabase.from('help_posts').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data as HelpPost;
      }
      const { data, error } = await supabase.from('help_posts').insert(payload).select().single();
      if (error) throw error;
      return data as HelpPost;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-posts'] });
      qc.invalidateQueries({ queryKey: ['help-post'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHelpPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('help_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-posts'] });
      toast.success('Post removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Viewer (Netflix) ----------

export function usePublishedHelpPosts() {
  return useQuery({
    queryKey: ['help-posts', 'published'],
    queryFn: async (): Promise<HelpPost[]> => {
      const { data, error } = await supabase
        .from('help_posts')
        .select('id, category_id, title, slug, summary, cover_image_url, status, is_featured, featured_order, tags, view_count, author_name, published_at, created_at, updated_at, content, content_html, author_id')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as HelpPost[];
    },
  });
}

export function useHelpPostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['help-post-slug', slug],
    queryFn: async (): Promise<HelpPost | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('help_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw error;
      return data as HelpPost | null;
    },
    enabled: !!slug,
  });
}

export function useRegisterHelpPostView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, userId }: { postId: string; userId: string }) => {
      const { error } = await supabase.rpc('increment_help_post_view', {
        p_post_id: postId,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-my-views'] });
    },
  });
}

export function useMyHelpViews(userId: string | undefined) {
  return useQuery({
    queryKey: ['help-my-views', userId],
    queryFn: async (): Promise<{ post_id: string; viewed_at: string }[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('help_post_views')
        .select('post_id, viewed_at')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}