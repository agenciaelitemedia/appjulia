// Resolve the quoted_message preview object for an inbound reply, so received
// replies render the original message reference (like WhatsApp Web) reusing the
// same metadata.quoted_message shape the frontend already renders.
// Best-effort: never throws (returns null on any error).

export interface QuotedMeta {
  id: string;
  text?: string;
  from_me: boolean;
  sender_name?: string;
  type?: string;
}

// deno-lint-ignore no-explicit-any
export async function resolveQuotedMeta(
  supabase: any,
  clientId: string,
  quotedId: string | null | undefined,
  embedded?: { text?: string | null; type?: string | null; from_me?: boolean; sender_name?: string | null },
): Promise<QuotedMeta | null> {
  try {
    if (quotedId) {
      const { data: orig } = await supabase
        .from("chat_messages")
        .select("id, text, from_me, sender_name, type, metadata")
        .eq("client_id", clientId)
        .or(`message_id.eq.${quotedId},external_id.eq.${quotedId}`)
        .limit(1)
        .maybeSingle();
      if (orig) {
        return {
          id: orig.id,
          text: orig.text ?? undefined,
          from_me: !!orig.from_me,
          sender_name: orig.sender_name ?? orig.metadata?.sender_name ?? undefined,
          type: orig.type ?? undefined,
        };
      }
    }
    // Fallback: use the content embedded in the payload (UaZapi quotedMessage).
    if (embedded && (embedded.text || embedded.type)) {
      return {
        id: quotedId ? String(quotedId) : "",
        text: embedded.text ?? undefined,
        from_me: !!embedded.from_me,
        sender_name: embedded.sender_name ?? undefined,
        type: embedded.type ?? undefined,
      };
    }
    return null;
  } catch (e) {
    console.warn("[resolveQuotedMeta] failed:", e);
    return null;
  }
}
