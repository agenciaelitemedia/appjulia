import React from 'react';
import { ChatChannelsConfig } from '@/components/chat/ChatChannelsConfig';

export default function ChatChannelsPage({ embedded = false }: { embedded?: boolean }) {
  return <ChatChannelsConfig embedded={embedded} />;
}
