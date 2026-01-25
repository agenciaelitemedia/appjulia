import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CreativeCategory, CreativeFile, CriativosFiltersState } from '../types';

export function useCreativeCategories() {
  return useQuery({
    queryKey: ['creative-categories'],
    queryFn: async () => {
      return externalDb.raw<CreativeCategory>({
        query: `
          SELECT id, name, created_at, update_at
          FROM creative_category
          ORDER BY name ASC
        `,
      });
    },
  });
}

export function useMyCreatives(filters: CriativosFiltersState, userId: number | undefined) {
  return useQuery({
    queryKey: ['my-creatives', filters, userId],
    queryFn: async () => {
      const whereConditions = ['f.user_id = $1'];
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters.typeFile !== 'all') {
        whereConditions.push(`f.type_file = $${paramIndex}`);
        params.push(filters.typeFile);
        paramIndex++;
      }

      if (filters.categoryId) {
        whereConditions.push(`f.creative_category_id = $${paramIndex}`);
        params.push(filters.categoryId);
        paramIndex++;
      }

      if (filters.search) {
        whereConditions.push(`(
          f.title ILIKE $${paramIndex} 
          OR f.description ILIKE $${paramIndex}
          OR f.name ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.search}%`);
      }

      return externalDb.raw<CreativeFile>({
        query: `
          SELECT 
            f.id, f.creative_category_id, f.user_id, f.type_file,
            f.name, f.title, f.description, f.shared, 
            f.created_at, f.update_at,
            c.name as category_name
          FROM creative_files f
          LEFT JOIN creative_category c ON f.creative_category_id = c.id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY f.created_at DESC
        `,
        params,
      });
    },
    enabled: !!userId,
  });
}

export function useSharedCreatives(filters: CriativosFiltersState, userId: number | undefined) {
  return useQuery({
    queryKey: ['shared-creatives', filters, userId],
    queryFn: async () => {
      const whereConditions = ['f.shared = true', 'f.user_id != $1'];
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters.typeFile !== 'all') {
        whereConditions.push(`f.type_file = $${paramIndex}`);
        params.push(filters.typeFile);
        paramIndex++;
      }

      if (filters.categoryId) {
        whereConditions.push(`f.creative_category_id = $${paramIndex}`);
        params.push(filters.categoryId);
        paramIndex++;
      }

      if (filters.search) {
        whereConditions.push(`(
          f.title ILIKE $${paramIndex} 
          OR f.description ILIKE $${paramIndex}
          OR f.name ILIKE $${paramIndex}
        )`);
        params.push(`%${filters.search}%`);
      }

      return externalDb.raw<CreativeFile>({
        query: `
          SELECT 
            f.id, f.creative_category_id, f.user_id, f.type_file,
            f.name, f.title, f.description, f.shared, 
            f.created_at, f.update_at,
            c.name as category_name,
            u.name as user_name
          FROM creative_files f
          LEFT JOIN creative_category c ON f.creative_category_id = c.id
          LEFT JOIN users u ON f.user_id = u.id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY f.created_at DESC
        `,
        params,
      });
    },
    enabled: !!userId,
  });
}

interface CreateCreativeData {
  user_id: number;
  type_file: 'image' | 'video';
  name: string;
  title: string;
  description: string;
  creative_category_id: number | null;
  shared: boolean;
}

export function useCreateCreative() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateCreativeData) => {
      return externalDb.insert({
        table: 'creative_files',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-creatives'] });
      queryClient.invalidateQueries({ queryKey: ['shared-creatives'] });
    },
  });
}

interface UpdateCreativeData {
  id: number;
  title: string;
  description: string;
  creative_category_id: number | null;
  shared: boolean;
}

export function useUpdateCreative() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateCreativeData) => {
      const { id, ...updateData } = data;
      return externalDb.update({
        table: 'creative_files',
        data: { ...updateData, update_at: new Date().toISOString() },
        where: { id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-creatives'] });
      queryClient.invalidateQueries({ queryKey: ['shared-creatives'] });
    },
  });
}

export function useDeleteCreative() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.delete({
        table: 'creative_files',
        where: { id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-creatives'] });
      queryClient.invalidateQueries({ queryKey: ['shared-creatives'] });
    },
  });
}
