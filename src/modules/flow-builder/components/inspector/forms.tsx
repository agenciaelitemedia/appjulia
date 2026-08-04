import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFlowQueues } from '../../extend/queues';
import { useFlowTags, useFlowQuickMessages } from '../../extend/chat';
import type { FlowNodeConfig } from '../../types';

export interface NodeFormProps {
  config: FlowNodeConfig;
  onChange: (patch: FlowNodeConfig) => void;
}

const VARIABLES = ['{{nome}}', '{{telefone}}', '{{protocolo}}', '{{fila}}', '{{atendente}}'];

function VariableChips({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {VARIABLES.map((v) => (
        <Badge
          key={v}
          variant="secondary"
          className="cursor-pointer font-mono text-[11px] hover:bg-secondary/70"
          onClick={() => onInsert(v)}
        >
          {v}
        </Badge>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── Disparo: mensagem recebida ─────────────────────────────── */
export function TriggerMessageForm({ config, onChange }: NodeFormProps) {
  const { data: queues = [] } = useFlowQueues();
  const keywords = String(config.keywords ?? '');
  return (
    <div className="space-y-4">
      <Field label="Fila" hint="Deixe em branco para valer para todas as filas.">
        <Select
          value={String(config.queue_id ?? 'all')}
          onValueChange={(v) => onChange({ queue_id: v === 'all' ? '' : v })}
        >
          <SelectTrigger><SelectValue placeholder="Todas as filas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as filas</SelectItem>
            {queues.map((q) => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Palavras-chave" hint="Separe por vírgula. Vazio = qualquer mensagem.">
        <Input value={keywords} onChange={(e) => onChange({ keywords: e.target.value })} placeholder="orçamento, preço" />
      </Field>
      <Field label="Correspondência">
        <Select value={String(config.match_mode ?? 'contains')} onValueChange={(v) => onChange({ match_mode: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contém</SelectItem>
            <SelectItem value="exact">Exata</SelectItem>
            <SelectItem value="starts">Começa com</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tipo de mídia">
        <Select value={String(config.media_type ?? 'any')} onValueChange={(v) => onChange({ media_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Qualquer</SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="audio">Áudio</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
            <SelectItem value="document">Documento</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Só em horário de atendimento</p>
          <p className="text-[11px] text-muted-foreground">Ignora mensagens fora do horário.</p>
        </div>
        <Switch
          checked={Boolean(config.only_business_hours)}
          onCheckedChange={(v) => onChange({ only_business_hours: v })}
        />
      </div>
    </div>
  );
}

/* ── Lógica: condição ───────────────────────────────────────── */
export const CONDITION_FIELDS = [
  { value: 'message_text', label: 'Texto da mensagem' },
  { value: 'conversation_status', label: 'Status da conversa' },
  { value: 'queue_name', label: 'Nome da fila' },
  { value: 'assigned_to', label: 'Atendente responsável' },
  { value: 'contact_name', label: 'Nome do contato' },
  { value: 'contact_phone', label: 'Telefone do contato' },
  { value: 'julia_active', label: 'Julia ativa' },
];

export const CONDITION_OPERATORS = [
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'equals', label: 'é igual a' },
  { value: 'not_equals', label: 'é diferente de' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'is_not_empty', label: 'não está vazio' },
];

export function ConditionForm({ config, onChange }: NodeFormProps) {
  const operator = String(config.operator ?? 'contains');
  const needsValue = operator !== 'is_empty' && operator !== 'is_not_empty';
  return (
    <div className="space-y-4">
      <Field label="Campo">
        <Select value={String(config.field ?? '')} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger><SelectValue placeholder="Escolha o campo" /></SelectTrigger>
          <SelectContent>
            {CONDITION_FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Operador">
        <Select value={operator} onValueChange={(v) => onChange({ operator: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONDITION_OPERATORS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {needsValue && (
        <Field label="Valor">
          <Input value={String(config.value ?? '')} onChange={(e) => onChange({ value: e.target.value })} />
        </Field>
      )}
      <p className="text-[11px] text-muted-foreground">
        Saídas do nó: <span className="font-medium">Verdadeiro</span> e <span className="font-medium">Falso</span>.
      </p>
    </div>
  );
}

/* ── Chat: enviar texto ─────────────────────────────────────── */
export function SendTextForm({ config, onChange }: NodeFormProps) {
  const { data: quick = [] } = useFlowQuickMessages();
  const text = String(config.text ?? '');
  return (
    <div className="space-y-4">
      <Field label="Mensagem">
        <Textarea
          value={text}
          rows={5}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Olá {{nome}}, como podemos ajudar?"
        />
        <VariableChips onInsert={(v) => onChange({ text: `${text}${text ? ' ' : ''}${v}` })} />
      </Field>
      {quick.length > 0 && (
        <Field label="Usar mensagem rápida">
          <Select
            value=""
            onValueChange={(id) => {
              const qm = quick.find((q) => q.id === id);
              if (qm) onChange({ text: qm.message_text || qm.title, quick_message_id: qm.id });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Escolher da biblioteca" /></SelectTrigger>
            <SelectContent>
              {quick.map((q) => (
                <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label="Atraso antes de enviar" hint={`${Number(config.delay_seconds ?? 0)} segundo(s)`}>
        <Slider
          value={[Number(config.delay_seconds ?? 0)]}
          min={0}
          max={60}
          step={1}
          onValueChange={([v]) => onChange({ delay_seconds: v })}
        />
      </Field>
    </div>
  );
}

/* ── Chat: etiquetar ────────────────────────────────────────── */
export function TagForm({ config, onChange }: NodeFormProps) {
  const { data: tags = [] } = useFlowTags();
  return (
    <div className="space-y-4">
      <Field label="Ação">
        <Select value={String(config.action ?? 'add')} onValueChange={(v) => onChange({ action: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add">Adicionar etiqueta</SelectItem>
            <SelectItem value="remove">Remover etiqueta</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Etiqueta">
        <Select
          value={String(config.tag_id ?? '')}
          onValueChange={(v) => {
            const tag = tags.find((t) => t.id === v);
            onChange({ tag_id: v, tag_name: tag?.name ?? '' });
          }}
        >
          <SelectTrigger><SelectValue placeholder={tags.length ? 'Escolha a etiqueta' : 'Nenhuma etiqueta cadastrada'} /></SelectTrigger>
          <SelectContent>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/* ── Chat: encaminhar para humano ───────────────────────────── */
export function HandoffForm({ config, onChange }: NodeFormProps) {
  const { data: queues = [] } = useFlowQueues();
  return (
    <div className="space-y-4">
      <Field label="Transferir para a fila" hint="Deixe em branco para manter a fila atual.">
        <Select
          value={String(config.queue_id ?? 'keep')}
          onValueChange={(v) => onChange({ queue_id: v === 'keep' ? '' : v })}
        >
          <SelectTrigger><SelectValue placeholder="Manter fila atual" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keep">Manter fila atual</SelectItem>
            {queues.map((q) => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Prioridade">
        <Select value={String(config.priority ?? 'normal')} onValueChange={(v) => onChange({ priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Desativar Julia</p>
          <p className="text-[11px] text-muted-foreground">Pausa a IA ao passar para o humano.</p>
        </div>
        <Switch
          checked={config.disable_julia !== false}
          onCheckedChange={(v) => onChange({ disable_julia: v })}
        />
      </div>
      <Field label="Nota interna (opcional)">
        <Textarea
          rows={3}
          value={String(config.note ?? '')}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Motivo do encaminhamento"
        />
      </Field>
    </div>
  );
}

/* ── Encerrar fluxo ─────────────────────────────────────────── */
export function EndForm({ config, onChange }: NodeFormProps) {
  return (
    <div className="space-y-4">
      <Field label="Motivo do encerramento">
        <Input
          value={String(config.reason ?? '')}
          onChange={(e) => onChange({ reason: e.target.value })}
          placeholder="Ex: atendimento concluído"
        />
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Resolver conversa</p>
          <p className="text-[11px] text-muted-foreground">Marca o atendimento como resolvido.</p>
        </div>
        <Switch
          checked={Boolean(config.resolve_conversation)}
          onCheckedChange={(v) => onChange({ resolve_conversation: v })}
        />
      </div>
    </div>
  );
}