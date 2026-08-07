/**
 * extend/chat — ponte para o chat (abrir conversa da sessão do X-Julia).
 */
import { useNavigate } from 'react-router-dom';

export function useOpenChatConversation() {
  const navigate = useNavigate();
  return (params: { contactId?: string | null; phone?: string | null }) => {
    const search = new URLSearchParams();
    if (params.contactId) search.set('contact', params.contactId);
    if (params.phone) search.set('phone', String(params.phone));
    navigate(`/chat${search.toString() ? `?${search.toString()}` : ''}`);
  };
}