import { useState, useCallback, memo, useEffect } from 'react';
import { Video, RefreshCw, Users, PhoneCall, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useVideoRooms, useCloseVideoRoom, useOperatorJoinRoom } from './hooks/useVideoRoom';
import { useRealtimeQueue } from './hooks/useRealtimeQueue';
import { VideoQueueCard } from './components/VideoQueueCard';
import { CustomVideoCall } from './components/CustomVideoCall';
import { PreJoinLobby } from './components/PreJoinLobby';
import { CallHistorySection } from './components/CallHistorySection';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';
import type { VideoRoom } from './types';

// Memoized video call component to prevent re-renders from polling
const ActiveCallSection = memo(function ActiveCallSection({ 
  room, 
  operatorId,
  operatorName,
  onLeave, 
  onError 
}: { 
  room: VideoRoom;
  operatorId?: number;
  operatorName?: string;
  onLeave: () => void;
  onError: (error: string) => void;
}) {
  return (
    <Card className="h-full min-h-[400px] overflow-hidden">
      <CustomVideoCall
        roomUrl={room.url}
        roomName={room.name}
        operatorId={operatorId}
        operatorName={operatorName}
        onLeave={onLeave}
        onError={onError}
      />
    </Card>
  );
});

// Pre-join lobby section
const LobbySection = memo(function LobbySection({
  room,
  userName,
  onJoin,
  onCancel,
}: {
  room: VideoRoom;
  userName?: string;
  onJoin: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="h-full min-h-[400px] overflow-hidden">
      <PreJoinLobby
        roomUrl={room.url}
        userName={userName}
        onJoin={onJoin}
        onCancel={onCancel}
      />
    </Card>
  );
});

type CallState = 'idle' | 'lobby' | 'call';

export default function VideoQueuePage() {
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<VideoRoom | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [userAgents, setUserAgents] = useState<string[]>([]);
  
  // Fetch user's cod_agents for multi-tenant filtering
  useEffect(() => {
    if (user?.id) {
      externalDb.getUserAgents(user.id).then(agents => {
        setUserAgents(agents.map(a => a.cod_agent));
      }).catch(console.error);
    }
  }, [user?.id]);

  const { data: rooms = [], isLoading, refetch, isFetching } = useVideoRooms(userAgents);
  const closeRoom = useCloseVideoRoom();
  const operatorJoin = useOperatorJoinRoom();

  // Realtime updates for queue
  useRealtimeQueue({
    codAgents: userAgents,
    onQueueUpdate: useCallback(() => {
      refetch();
    }, [refetch]),
  });

  // When user clicks "Atender" on a room card, show lobby first
  const handleJoinRoom = useCallback((room: VideoRoom) => {
    setSelectedRoom(room);
    setCallState('lobby');
  }, []);

  // When user confirms from lobby, notify backend and start the actual call
  const handleConfirmJoin = useCallback(() => {
    if (!selectedRoom) return;
    
    // Notify backend that operator is joining
    operatorJoin.mutate({
      roomName: selectedRoom.name,
      operatorId: user?.id,
      operatorName: user?.name,
    }, {
      onSuccess: () => {
        setCallState('call');
      },
      onError: (error) => {
        console.error('Failed to notify operator join:', error);
        // Still proceed with call even if notification fails
        setCallState('call');
      },
    });
  }, [selectedRoom, operatorJoin, user]);

  // When user cancels from lobby, go back to idle
  const handleCancelLobby = useCallback(() => {
    setSelectedRoom(null);
    setCallState('idle');
  }, []);

  const handleLeaveRoom = useCallback(() => {
    if (selectedRoom) {
      closeRoom.mutate(selectedRoom.name);
    }
    setSelectedRoom(null);
    setCallState('idle');
  }, [selectedRoom, closeRoom]);

  const handleVideoError = useCallback((error: string) => {
    console.error('Video call error:', error);
    setSelectedRoom(null);
    setCallState('idle');
    toast.error('Erro ao conectar. Tente novamente.');
  }, []);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Video className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sala de Reunião</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas reuniões por vídeo com leads
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="atendimento" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="atendimento" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Atendimento
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atendimento" className="mt-6">
          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue column */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Leads Aguardando
                    </div>
                    <Badge variant="secondary">
                      {rooms.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-350px)] min-h-[200px]">
                    <div className="p-4 space-y-3">
                      {isLoading ? (
                        <>
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full" />
                          ))}
                        </>
                      ) : rooms.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <PhoneCall className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">Nenhum lead aguardando</p>
                          <p className="text-sm mt-1">
                            Leads aparecerão aqui quando entrarem na sala
                          </p>
                        </div>
                      ) : (
                        rooms.map((room) => (
                          <VideoQueueCard
                            key={room.name}
                            room={room}
                            onJoin={handleJoinRoom}
                            isActive={selectedRoom?.name === room.name && callState !== 'idle'}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Video call / Lobby column */}
            <div className="lg:col-span-2">
              {callState === 'call' && selectedRoom ? (
                <ActiveCallSection
                  room={selectedRoom}
                  operatorId={user?.id}
                  operatorName={user?.name}
                  onLeave={handleLeaveRoom}
                  onError={handleVideoError}
                />
              ) : callState === 'lobby' && selectedRoom ? (
                <LobbySection
                  room={selectedRoom}
                  userName={user?.name}
                  onJoin={handleConfirmJoin}
                  onCancel={handleCancelLobby}
                />
              ) : (
                <Card className="h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium">Nenhuma chamada ativa</h3>
                    <p className="text-sm mt-2 max-w-sm">
                      Selecione um lead da fila para iniciar o atendimento por vídeo
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <CallHistorySection expanded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
