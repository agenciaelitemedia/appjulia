export interface CreativeCategory {
  id: number;
  name: string;
  created_at: string;
  update_at: string;
}

export interface CreativeFile {
  id: number;
  creative_category_id: number | null;
  user_id: number;
  type_file: 'image' | 'video';
  name: string;
  title: string;
  description: string | null;
  shared: boolean;
  created_at: string;
  update_at: string;
  // Campos virtuais para join
  category_name?: string;
  user_name?: string;
}

export interface CriativosFiltersState {
  search: string;
  categoryId: number | null;
  typeFile: 'all' | 'image' | 'video';
}

export interface UploadFormData {
  title: string;
  description: string;
  categoryId: number | null;
  shared: boolean;
  file: File | null;
}
