import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseNode } from '../nodes/BaseNode';
import type { FlowCanvasEdge, FlowCanvasNode } from '../../types';

export const ANIMATED_EDGE = {
  type: 'default' as const,
  animated: true,
  style: { stroke: 'hsl(var(--flow-edge))', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--flow-edge))' },
};

interface FlowCanvasProps {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  setEdges: (updater: (edges: FlowCanvasEdge[]) => FlowCanvasEdge[]) => void;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  onDropNode: (kind: string, position: { x: number; y: number }) => void;
  readOnly: boolean;
  /** Bloco em foco na simulação passo a passo. */
  highlightNodeId?: string | null;
  /** Abre as propriedades do nó ao dar duplo clique. */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Fecha o painel de propriedades ao clicar no canvas vazio. */
  onPaneClick?: () => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setEdges,
  onSelectionChange,
  onDropNode,
  readOnly,
  highlightNodeId,
  onNodeDoubleClick,
  onPaneClick,
}: FlowCanvasProps) {
  const nodeTypes = useMemo(() => ({ flowNode: BaseNode }), []);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const focusNodeId = highlightNodeId ?? hoveredNodeId;

  // Destaca a ligação quando o mouse passa pelo nó ou pela própria conexão.
  const decoratedEdges = useMemo(() => {
    if (!focusNodeId && !hoveredEdgeId) return edges;
    return edges.map((edge) => {
      const active =
        edge.id === hoveredEdgeId ||
        (!!focusNodeId && (edge.source === focusNodeId || edge.target === focusNodeId));
      if (!active) return { ...edge, style: { ...(edge.style ?? {}), opacity: 0.35 } };
      return {
        ...edge,
        animated: true,
        zIndex: 10,
        style: {
          ...(edge.style ?? {}),
          opacity: 1,
          stroke: 'hsl(var(--primary))',
          strokeWidth: 3.5,
          filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.5))',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
      };
    });
  }, [edges, focusNodeId, hoveredEdgeId]);

  const decoratedNodes = useMemo(() => {
    if (!highlightNodeId) return nodes;
    return nodes.map((node) =>
      node.id === highlightNodeId
        ? { ...node, className: `${node.className ?? ''} ring-2 ring-primary ring-offset-2 rounded-xl`.trim() }
        : { ...node, className: (node.className ?? '').replace(/ring-2 ring-primary ring-offset-2 rounded-xl/g, '').trim() },
    );
  }, [nodes, highlightNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge({ ...connection, ...ANIMATED_EDGE }, eds));
    },
    [readOnly, setEdges],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) return;
      const kind = event.dataTransfer.getData('application/flow-node');
      if (!kind) return;
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      onDropNode(kind, {
        x: event.clientX - (bounds?.left ?? 0) - 132,
        y: event.clientY - (bounds?.top ?? 0) - 40,
      });
    },
    [onDropNode, readOnly],
  );

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={decoratedEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
      onNodeMouseLeave={() => setHoveredNodeId(null)}
      onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
      onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
      onEdgeMouseLeave={() => setHoveredEdgeId(null)}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onPaneClick={onPaneClick}
      defaultEdgeOptions={ANIMATED_EDGE}
      connectionLineStyle={{ stroke: 'hsl(var(--flow-edge))', strokeWidth: 2 }}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable
      deleteKeyCode={null}
      fitView
      minZoom={0.2}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      className="bg-flow-canvas"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="hsl(var(--flow-grid))" />
      <Controls showInteractive={false} className="!rounded-lg !border !bg-card !shadow-sm" />
      <MiniMap
        pannable
        zoomable
        className="!rounded-lg !border !bg-card"
        maskColor="hsl(var(--muted) / 0.6)"
        nodeColor="hsl(var(--flow-edge))"
      />
    </ReactFlow>
  );
}