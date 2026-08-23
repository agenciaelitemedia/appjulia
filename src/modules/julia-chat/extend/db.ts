/**
 * extend/db — único ponto de acesso a dados do módulo JulIA Chat.
 * Nenhuma query existente é reutilizada ou alterada: o módulo fala apenas
 * com a edge function `mvp-chat-list-feed`.
 */
export { supabase } from '@/integrations/supabase/client';
