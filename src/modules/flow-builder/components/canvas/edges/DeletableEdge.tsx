import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { X } from 'lucide-react';

interface EdgeCallbacks {
  onDelete: (edgeId: string) => void;
  readOnly: boolean;
}

let callbacks: EdgeCallbacks = { onDelete: () => {}, readOnly: false };
export function setEdgeCallbacks(next: EdgeCallbacks) {
  callbacks = next;
}

/** Ligação com botão de excluir que aparece ao passar o mouse sobre a linha. */
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [hover, setHover] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <path
        d={edgePath}
        fill="none"
        strokeWidth={22}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      {!callbacks.readOnly && hover && (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan absolute flex h-6 w-6 items-center justify-center rounded-full border border-destructive/40 bg-card text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
            title="Excluir ligação"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={(e) => {
              e.stopPropagation();
              callbacks.onDelete(id);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}