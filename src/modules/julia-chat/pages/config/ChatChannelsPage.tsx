import React from 'react';
import { ChatChannelsConfig } from '@/modules/julia-chat/chat/components/ChatChannelsConfig';

export default function ChatChannelsPage({ embedded = false }: { embedded?: boolean }) {
  return <ChatChannelsConfig embedded={embedded} />;
}
