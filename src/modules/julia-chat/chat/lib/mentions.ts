import { supabase } from '@/integrations/supabase/client';

export interface ParsedMention {
  user_identifier: string;
  user_name: string;
}

/**
 * Parse text and create mention rows for any "@name" tokens that match
 * the provided team members list.
 */
export async function persistMentionsFromNote(params: {
  conversation_id: string;
  message_id: string;
  text: string;
  team: Array<{ id: number | string; name: string }>;
  by_id?: string;
  by_name?: string;
}) {
  const { conversation_id, message_id, text, team, by_id, by_name } = params;
  if (!text) return;

  const found = new Map<string, ParsedMention>();
  for (const m of team) {
    // Build a forgiving pattern: @name (case insensitive, allow first word match too)
    const tokens = m.name.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const first = tokens[0];
    const fullPattern = new RegExp(`@${m.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i');
    const firstPattern = new RegExp(`@${first.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
    if (fullPattern.test(text) || firstPattern.test(text)) {
      found.set(String(m.id), { user_identifier: String(m.id), user_name: m.name });
    }
  }

  if (found.size === 0) return;

  const rows = Array.from(found.values()).map((u) => ({
    conversation_id,
    message_id,
    mentioned_user: u.user_identifier,
    mentioned_user_name: u.user_name,
    mentioned_by: by_id || null,
    mentioned_by_name: by_name || null,
    preview_text: text.slice(0, 200),
  }));

  await supabase.from('chat_mentions').insert(rows);
}
