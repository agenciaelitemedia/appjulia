import { useCallback, useMemo } from 'react';
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
  type: 'smoothstep' as const,
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
}: FlowCanvasProps) {
  const nodeTypes = useMemo(() => ({ flowNode: BaseNode }), []);

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
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
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