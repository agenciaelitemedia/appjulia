/**
 * extend/db — único ponto de acesso a banco do módulo Escritórios.
 * Se o cliente de dados mudar no sistema, só este arquivo é ajustado.
 */
export { supabase } from '@/integrations/supabase/client';
export { externalDb } from '@/lib/externalDb';