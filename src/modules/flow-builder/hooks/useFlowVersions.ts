import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { FlowCanvasEdge, FlowCanvasNode } from '../types';

export interface FlowVersionRecord {
  id: string;
  flow_id: string;
  version: number;
  status: 'published' | 'archived' | 'draft';
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  start_node_id: string | null;
  notes: string | null;
  created_at: string;
}

const TABLE = 'chat_bot_flow_versions';
const KEY = 'flow-builder-versions';

export function useFlowVersions(flowId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [KEY, flowId],
    enabled: !!flowId && options?.enabled !== false,
    queryFn: async (): Promise<FlowVersionRecord[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('id, flow_id, version, status, nodes, edges, start_node_id, notes, created_at')
        .eq('flow_id', flowId)
        .order('version', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        flow_id: String(row.flow_id),
        version: Number(row.version ?? 1),
        status: (String(row.status ?? 'archived') as FlowVersionRecord['status']),
        nodes: Array.isArray(row.nodes) ? (row.nodes as FlowCanvasNode[]) : [],
        edges: Array.isArray(row.edges) ? (row.edges as FlowCanvasEdge[]) : [],
        start_node_id: (row.start_node_id as string) ?? null,
        notes: (row.notes as string) ?? null,
        created_at: String(row.created_at ?? ''),
      }));
    },
  });
}

/** Restaura o desenho de uma versão antiga como rascunho do editor. */
export function useRestoreFlowVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (version: FlowVersionRecord) => {
      const { error } = await supabase
        .from('chat_bot_flows')
        .update({
          nodes: version.nodes,
          edges: version.edges,
          start_node_id: version.start_node_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', version.flow_id);
      if (error) throw error;
      return version;
    },
    onSuccess: (version) => {
      toast.success(`Versão ${version.version} carregada como rascunho`);
      queryClient.invalidateQueries({ queryKey: ['flow-builder-flows'] });
    },
    onError: (e: Error) => toast.error(`Falha ao restaurar versão: ${e.message}`),
  });
}