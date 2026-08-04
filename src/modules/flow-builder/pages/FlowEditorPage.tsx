import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import {
  ArrowLeft,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Play,
  Undo2,
  Redo2,
  LayoutTemplate,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { FlowCanvas } from '../components/canvas/FlowCanvas';
import { NodePalette } from '../components/palette/NodePalette';
import { NodeInspector } from '../components/inspector/NodeInspector';
import { FlowTestPanel } from '../components/test/FlowTestPanel';
import { FlowRunsPanel } from '../components/runs/FlowRunsPanel';
import { setNodeCallbacks } from '../components/nodes/BaseNode';
import { useFlowEditorState } from '../hooks/useFlowEditorState';
import { useFlow, useFlowMutations } from '../hooks/useFlows';
import { useFlowBuilderPermissions } from '../extend/auth';
import { FLOW_BUILDER_ROUTES } from '../module';
import { getNodeDefinition } from '../registry/nodeRegistry';
import type { FlowNodeKind } from '../types';

export default function FlowEditorPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const permissions = useFlowBuilderPermissions();
  const readOnly = !permissions.canEdit;
  const { data: flow, isLoading } = useFlow(flowId);
  const { saveFlow } = useFlowMutations();

  const editor = useFlowEditorState([], []);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);

  useEffect(() => {
    if (!flow) return;
    setName(flow.name);
    setIsActive(flow.is_active);
    editor.reset(flow.nodes, flow.edges);
    if (flow.migrated_from_legacy) {
      editor.setDirty(true);
      toast.info('Fluxo do construtor antigo convertido — revise os blocos e salve para concluir a migração.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.id]);

  useEffect(() => {
    setNodeCallbacks({
      onRequestDelete: (id) => setPendingDelete(id),
      onDuplicate: editor.duplicateNode,
      readOnly,
    });
  }, [editor.duplicateNode, readOnly]);

  const handleSave = async () => {
    if (!flowId) return;
    if (isActive && editor.issues.length > 0) {
      toast.error('Corrija os avisos antes de ativar a automação.');
      return;
    }
    await saveFlow.mutateAsync({
      id: flowId,
      name: name.trim() || 'Automação sem nome',
      nodes: editor.nodes,
      edges: editor.edges,
      is_active: isActive,
    });
    editor.setDirty(false);
    toast.success('Automação salva');
  };

  // Atalhos: desfazer, refazer e salvar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (readOnly) return;
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (key === 'y') {
        event.preventDefault();
        if (!readOnly) editor.redo();
      } else if (key === 's') {
        event.preventDefault();
        if (!readOnly && editor.dirty) void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.redo, editor.undo, editor.dirty, readOnly, editor.nodes, editor.edges, name, isActive]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Automação não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(FLOW_BUILDER_ROUTES.list)}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const deleteTarget = pendingDelete ? editor.nodes.find((n) => n.id === pendingDelete) : null;
  const deleteLabel = deleteTarget
    ? deleteTarget.data.label || getNodeDefinition(deleteTarget.data.kind)?.label || 'bloco'
    : '';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(FLOW_BUILDER_ROUTES.list)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          disabled={readOnly}
          onChange={(e) => {
            setName(e.target.value);
            editor.setDirty(true);
          }}
          className="h-9 w-64 font-medium"
          placeholder="Nome da automação"
        />
        {editor.issues.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                <AlertTriangle className="h-3 w-3" /> {editor.issues.length} aviso(s)
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <ul className="list-inside list-disc space-y-1 text-xs">
                {editor.issues.slice(0, 6).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> Fluxo válido
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={editor.undo}
              disabled={readOnly || !editor.canUndo}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={editor.redo}
              disabled={readOnly || !editor.canRedo}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={editor.applyAutoLayout}
              disabled={readOnly || editor.nodes.length === 0}
              title="Organizar blocos automaticamente"
            >
              <LayoutTemplate className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => setRunsOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Execuções
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setTestOpen(true)}
            disabled={editor.dirty}
            title={editor.dirty ? 'Salve a automação antes de testar' : 'Simular execução'}
          >
            <Play className="mr-2 h-4 w-4" />
            Testar
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="flow-active"
              checked={isActive}
              disabled={readOnly}
              onCheckedChange={(v) => {
                setIsActive(v);
                editor.setDirty(true);
              }}
            />
            <Label htmlFor="flow-active" className="text-xs font-medium">
              {isActive ? 'Ativa' : 'Pausada'}
            </Label>
          </div>
          <Button onClick={handleSave} disabled={readOnly || saveFlow.isPending || !editor.dirty} className="rounded-full">
            {saveFlow.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <NodePalette onAdd={(kind) => editor.addNode(kind)} disabled={readOnly} />
        <div className="min-w-0 flex-1">
          <ReactFlowProvider>
            <FlowCanvas
              nodes={editor.nodes}
              edges={editor.edges}
              onNodesChange={editor.onNodesChange}
              onEdgesChange={editor.onEdgesChange}
              setEdges={(updater) => {
                editor.pushHistory();
                editor.setEdges(updater);
              }}
              onSelectionChange={editor.onSelectionChange}
              onDropNode={(kind, position) => editor.addNode(kind as FlowNodeKind, position)}
              readOnly={readOnly}
            />
          </ReactFlowProvider>
        </div>
        <NodeInspector
          node={editor.selectedNode}
          onChangeLabel={editor.setNodeLabel}
          onChangeConfig={editor.setNodeConfig}
          onRequestDelete={(id) => setPendingDelete(id)}
          readOnly={readOnly}
        />
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteLabel}"?</AlertDialogTitle>
            <AlertDialogDescription>
              As ligações conectadas a este bloco também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) editor.deleteNode(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Excluir bloco
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flowId && <FlowTestPanel flowId={flowId} open={testOpen} onOpenChange={setTestOpen} />}
      {flowId && <FlowRunsPanel flowId={flowId} open={runsOpen} onOpenChange={setRunsOpen} />}
    </div>
  );
}