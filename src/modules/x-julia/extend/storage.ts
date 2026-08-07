/**
 * extend/storage — upload de mídias do módulo (base de conhecimento e followups).
 */
import { supabase } from './db';

const BUCKET = 'chat-media';

export async function uploadXJFile(clientId: string, file: File, folder = 'x-julia'): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}