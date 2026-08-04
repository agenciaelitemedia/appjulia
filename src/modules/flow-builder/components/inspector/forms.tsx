import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useFlowQueues } from '../../extend/queues';
import { useFlowTags, useFlowQuickMessages } from '../../extend/chat';
import { useFlowBoards, useFlowStages } from '../../extend/crm';
import { useFlowWebhooks } from '../../extend/webhooks';
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
  { value: 'channel', label: 'Canal da conversa' },
  { value: 'priority', label: 'Prioridade da conversa' },
  { value: 'minutes_since_lead_reply', label: 'Minutos desde a resposta do lead' },
  { value: 'minutes_since_agent_reply', label: 'Minutos desde a resposta do atendente' },
];

export const CONDITION_OPERATORS = [
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'equals', label: 'é igual a' },
  { value: 'not_equals', label: 'é diferente de' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'is_not_empty', label: 'não está vazio' },
  { value: 'greater_than', label: 'é maior que (número)' },
  { value: 'less_than', label: 'é menor que (número)' },
];

/* ── Tempo: seletor de duração reaproveitável ────────────────── */
const UNITS = [
  { value: 'seconds', label: 'segundos' },
  { value: 'minutes', label: 'minutos' },
  { value: 'hours', label: 'horas' },
  { value: 'days', label: 'dias' },
];

function DurationField({
  label,
  hint,
  config,
  onChange,
  units = UNITS,
}: NodeFormProps & { label: string; hint?: string; units?: typeof UNITS }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          className="w-24"
          value={String(config.amount ?? '')}
          onChange={(e) => onChange({ amount: Number(e.target.value) })}
        />
        <Select value={String(config.unit ?? units[0].value)} onValueChange={(v) => onChange({ unit: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

/* ── Disparo: inatividade (lead ou atendente) ───────────────── */
function InactivityForm({ config, onChange, side }: NodeFormProps & { side: 'lead' | 'agent' }) {
  const { data: queues = [] } = useFlowQueues();
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
      <DurationField
        label={side === 'lead' ? 'Tempo sem resposta do lead' : 'Tempo sem resposta do atendente'}
        hint={
          side === 'lead'
            ? 'Conta desde a última mensagem enviada pela equipe.'
            : 'Conta desde a última mensagem enviada pelo lead.'
        }
        config={config}
        onChange={onChange}
        units={UNITS.slice(1)}
      />
      <Field label="Intervalo mínimo entre disparos (minutos)" hint="Evita repetir a automação na mesma conversa.">
        <Input
          type="number"
          min={5}
          value={String(config.cooldown_minutes ?? 720)}
          onChange={(e) => onChange({ cooldown_minutes: Number(e.target.value) })}
        />
      </Field>
      <p className="text-[11px] text-muted-foreground">
        A verificação roda automaticamente a cada poucos minutos, apenas em conversas abertas ou pendentes.
      </p>
    </div>
  );
}

export function TriggerLeadInactiveForm(props: NodeFormProps) {
  return <InactivityForm {...props} side="lead" />;
}

export function TriggerAgentInactiveForm(props: NodeFormProps) {
  return <InactivityForm {...props} side="agent" />;
}

/* ── Lógica: aguardar tempo ─────────────────────────────────── */
export function DelayForm({ config, onChange }: NodeFormProps) {
  return (
    <div className="space-y-4">
      <DurationField label="Aguardar" config={config} onChange={onChange} />
      <p className="text-[11px] text-muted-foreground">
        Esperas de até 15 segundos acontecem na hora; acima disso o fluxo pausa e retoma sozinho depois.
      </p>
    </div>
  );
}

/* ── Lógica: aguardar resposta do lead ──────────────────────── */
export function WaitReplyForm({ config, onChange }: NodeFormProps) {
  return (
    <div className="space-y-4">
      <DurationField
        label="Aguardar resposta por até"
        hint="Se o lead responder antes, o fluxo segue por “Respondeu”."
        config={config}
        onChange={onChange}
        units={UNITS.slice(1)}
      />
      <p className="text-[11px] text-muted-foreground">
        Saídas do nó: <span className="font-medium">Respondeu</span> e <span className="font-medium">Sem resposta</span>.
      </p>
    </div>
  );
}

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
/* ── Julia: ativar / desativar ──────────────────────────────── */
export function JuliaToggleForm({ config, onChange }: NodeFormProps) {
  const mode = String(config.mode ?? 'on');
  return (
    <div className="space-y-4">
      <Field
        label="O que fazer com a Julia"
        hint="Ativar reagenda o followup do lead; desativar interrompe a IA e o followup."
      >
        <Select value={mode} onValueChange={(v) => onChange({ mode: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="on">Ativar Julia (com followup)</SelectItem>
            <SelectItem value="off">Desativar Julia e parar followup</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <p className="text-[11px] text-muted-foreground">
        O agente usado é o vinculado à fila da conversa.
      </p>
    </div>
  );
}

/* ── Julia: parar followup ──────────────────────────────────── */
export function FollowupStopForm() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Interrompe as mensagens de followup deste lead, mantendo a Julia ativa para responder.
      </p>
      <p className="text-[11px] text-muted-foreground">
        Não precisa de configuração: usa o lead da conversa e o agente vinculado à fila.
      </p>
    </div>
  );
}

/* ── CRM: seletores de quadro e fase ────────────────────────── */
function BoardField({ config, onChange, allowAny }: NodeFormProps & { allowAny?: boolean }) {
  const { data: boards = [] } = useFlowBoards();
  return (
    <Field label="Quadro do CRM" hint={allowAny ? 'Deixe em branco para procurar em qualquer quadro.' : undefined}>
      <Select
        value={String(config.board_id ?? (allowAny ? 'any' : ''))}
        onValueChange={(v) => onChange({ board_id: v === 'any' ? '' : v, pipeline_id: '' })}
      >
        <SelectTrigger><SelectValue placeholder={boards.length ? 'Escolha o quadro' : 'Nenhum quadro criado'} /></SelectTrigger>
        <SelectContent>
          {allowAny && <SelectItem value="any">Qualquer quadro</SelectItem>}
          {boards.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function StageField({ config, onChange, label, hint }: NodeFormProps & { label: string; hint?: string }) {
  const boardId = String(config.board_id ?? '');
  const { data: stages = [] } = useFlowStages(boardId);
  return (
    <Field label={label} hint={hint}>
      <Select
        value={String(config.pipeline_id ?? '')}
        onValueChange={(v) => onChange({ pipeline_id: v })}
        disabled={!boardId}
      >
        <SelectTrigger>
          <SelectValue placeholder={boardId ? (stages.length ? 'Escolha a fase' : 'Quadro sem fases') : 'Escolha o quadro primeiro'} />
        </SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

/* ── CRM: criar card ────────────────────────────────────────── */
export function CrmCreateCardForm({ config, onChange }: NodeFormProps) {
  const title = String(config.title ?? '');
  return (
    <div className="space-y-4">
      <BoardField config={config} onChange={onChange} />
      <StageField config={config} onChange={onChange} label="Fase inicial" hint="Vazio = primeira fase do quadro." />
      <Field label="Título do card">
        <Input
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Lead {{nome}}"
        />
        <VariableChips onInsert={(v) => onChange({ title: `${title}${title ? ' ' : ''}${v}` })} />
      </Field>
      <Field label="Observação (opcional)">
        <Textarea
          rows={3}
          value={String(config.description ?? '')}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Criado automaticamente pelo fluxo"
        />
      </Field>
      <Field label="Valor (opcional)">
        <Input
          type="number"
          min={0}
          value={String(config.value ?? '')}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      </Field>
      <Field label="Prioridade">
        <Select value={String(config.priority ?? 'medium')} onValueChange={(v) => onChange({ priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Responsável (opcional)">
        <Input
          value={String(config.assigned_to ?? '')}
          onChange={(e) => onChange({ assigned_to: e.target.value })}
          placeholder="Nome do responsável"
        />
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Não duplicar</p>
          <p className="text-[11px] text-muted-foreground">Ignora se o lead já tem card no quadro.</p>
        </div>
        <Switch
          checked={config.skip_if_exists !== false}
          onCheckedChange={(v) => onChange({ skip_if_exists: v })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Vincular conversa ao card</p>
          <p className="text-[11px] text-muted-foreground">Permite abrir o chat direto do card.</p>
        </div>
        <Switch
          checked={config.link_conversation !== false}
          onCheckedChange={(v) => onChange({ link_conversation: v })}
        />
      </div>
    </div>
  );
}

/* ── CRM: mover card ────────────────────────────────────────── */
export function CrmMoveCardForm({ config, onChange }: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoardField config={config} onChange={onChange} />
      <StageField config={config} onChange={onChange} label="Mover para a fase" />
      <p className="text-[11px] text-muted-foreground">
        O card é localizado pelo vínculo da conversa ou pelo telefone do lead.
      </p>
    </div>
  );
}

/* ── CRM: editar card ───────────────────────────────────────── */
export function CrmUpdateCardForm({ config, onChange }: NodeFormProps) {
  const title = String(config.title ?? '');
  return (
    <div className="space-y-4">
      <BoardField config={config} onChange={onChange} allowAny />
      <Field label="Novo título (opcional)">
        <Input value={title} onChange={(e) => onChange({ title: e.target.value })} placeholder="{{nome}} — retorno" />
        <VariableChips onInsert={(v) => onChange({ title: `${title}${title ? ' ' : ''}${v}` })} />
      </Field>
      <Field label="Prioridade" hint="Deixe em “Não alterar” para manter.">
        <Select
          value={String(config.priority ?? 'keep')}
          onValueChange={(v) => onChange({ priority: v === 'keep' ? '' : v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keep">Não alterar</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Situação">
        <Select
          value={String(config.status ?? 'keep')}
          onValueChange={(v) => onChange({ status: v === 'keep' ? '' : v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keep">Não alterar</SelectItem>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="won">Ganho</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Valor (opcional)">
        <Input
          type="number"
          min={0}
          value={String(config.value ?? '')}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      </Field>
      <Field label="Responsável (opcional)">
        <Input
          value={String(config.assigned_to ?? '')}
          onChange={(e) => onChange({ assigned_to: e.target.value })}
          placeholder="Nome do responsável"
        />
      </Field>
      <Field label="Observação (opcional)">
        <Textarea
          rows={3}
          value={String(config.description ?? '')}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ── CRM: vincular conversa ao card ─────────────────────────── */
export function CrmLinkConversationForm({ config, onChange }: NodeFormProps) {
  return (
    <div className="space-y-4">
      <BoardField config={config} onChange={onChange} allowAny />
      <p className="text-[11px] text-muted-foreground">
        Cria o vínculo entre a conversa atual e o card do lead, sem duplicar vínculos existentes.
      </p>
    </div>
  );
}

/* ── Dados: enviar para webhook ─────────────────────────────── */
export function WebhookForm({ config, onChange }: NodeFormProps) {
  const { data: webhooks = [] } = useFlowWebhooks();
  const webhookId = String(config.webhook_id ?? '');
  return (
    <div className="space-y-4">
      <Field label="Webhook cadastrado" hint="Escolha um webhook do chat ou informe uma URL abaixo.">
        <Select
          value={webhookId || 'custom'}
          onValueChange={(v) => onChange({ webhook_id: v === 'custom' ? '' : v })}
        >
          <SelectTrigger><SelectValue placeholder="URL avulsa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">URL avulsa</SelectItem>
            {webhooks.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {!webhookId && (
        <Field label="URL de destino">
          <Input
            value={String(config.url ?? '')}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://exemplo.com/webhook"
          />
        </Field>
      )}
      <Field label="Observação enviada (opcional)" hint="Vai no campo “note” do envio.">
        <Input
          value={String(config.note ?? '')}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Lead {{nome}} entrou no fluxo"
        />
      </Field>
      <Field label={`Tempo limite: ${Number(config.timeout_seconds ?? 15)}s`}>
        <Slider
          min={5}
          max={60}
          step={5}
          value={[Number(config.timeout_seconds ?? 15)]}
          onValueChange={([v]) => onChange({ timeout_seconds: v })}
        />
      </Field>
      <p className="text-[11px] text-muted-foreground">
        São enviados os dados da conversa, do contato, da fila, da mensagem e as variáveis do fluxo.
      </p>
    </div>
  );
}

/* ── Dados: requisição HTTP ─────────────────────────────────── */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface HeaderItem {
  key: string;
  value: string;
}

export function HttpRequestForm({ config, onChange }: NodeFormProps) {
  const method = String(config.method ?? 'GET');
  const headers: HeaderItem[] = Array.isArray(config.headers) ? (config.headers as HeaderItem[]) : [];
  const body = String(config.body ?? '');
  const setHeaders = (next: HeaderItem[]) => onChange({ headers: next });

  return (
    <div className="space-y-4">
      <Field label="Método">
        <Select value={method} onValueChange={(v) => onChange({ method: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="URL">
        <Input
          value={String(config.url ?? '')}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://api.exemplo.com/leads/{{telefone}}"
        />
      </Field>
      <Field label="Cabeçalhos" hint="Opcional. Use para autenticação, por exemplo.">
        <div className="space-y-2">
          {headers.map((h, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={h.key ?? ''}
                placeholder="Authorization"
                onChange={(e) =>
                  setHeaders(headers.map((item, i) => (i === index ? { ...item, key: e.target.value } : item)))
                }
              />
              <Input
                className="flex-1"
                value={h.value ?? ''}
                placeholder="Bearer ..."
                onChange={(e) =>
                  setHeaders(headers.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground"
                onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setHeaders([...headers, { key: '', value: '' }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cabeçalho
          </Button>
        </div>
      </Field>
      {method !== 'GET' && (
        <Field label="Corpo da requisição" hint="JSON aceito. Variáveis do fluxo podem ser usadas.">
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder={'{\n  "telefone": "{{telefone}}"\n}'}
          />
          <VariableChips onInsert={(v) => onChange({ body: `${body}${v}` })} />
        </Field>
      )}
      <Field label="Guardar resposta em" hint="Depois use como {{resp.data.campo}} nos outros nós.">
        <Input
          value={String(config.save_as ?? 'resp')}
          onChange={(e) => onChange({ save_as: e.target.value.replace(/[^\w]/g, '') })}
          placeholder="resp"
        />
      </Field>
      <Field label={`Tempo limite: ${Number(config.timeout_seconds ?? 15)}s`}>
        <Slider
          min={5}
          max={60}
          step={5}
          value={[Number(config.timeout_seconds ?? 15)]}
          onValueChange={([v]) => onChange({ timeout_seconds: v })}
        />
      </Field>
    </div>
  );
}

/* ── Dados: guardar dados / variáveis ───────────────────────── */
interface VariableItem {
  name: string;
  mode?: 'text' | 'path';
  value?: string;
  path?: string;
}

export function SetVariablesForm({ config, onChange }: NodeFormProps) {
  const items: VariableItem[] = Array.isArray(config.items) ? (config.items as VariableItem[]) : [];
  const setItems = (next: VariableItem[]) => onChange({ items: next });
  const patch = (index: number, data: Partial<VariableItem>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...data } : item)));

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma variável ainda. Elas ficam disponíveis nos nós seguintes como {'{{minha_variavel}}'}.
        </p>
      )}
      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              value={item.name ?? ''}
              placeholder="nome_da_variavel"
              onChange={(e) => patch(index, { name: e.target.value.replace(/[^\w]/g, '') })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Field label="Origem do valor">
            <Select value={item.mode ?? 'text'} onValueChange={(v) => patch(index, { mode: v as 'text' | 'path' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto (com variáveis)</SelectItem>
                <SelectItem value="path">Campo de uma resposta guardada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(item.mode ?? 'text') === 'text' ? (
            <Field label="Valor">
              <Input
                value={item.value ?? ''}
                placeholder="{{nome}} — via automação"
                onChange={(e) => patch(index, { value: e.target.value })}
              />
              <VariableChips onInsert={(v) => patch(index, { value: `${item.value ?? ''}${v}` })} />
            </Field>
          ) : (
            <Field label="Caminho" hint="Ex.: resp.data.id (usa o que foi guardado na requisição HTTP).">
              <Input
                className="font-mono text-xs"
                value={item.path ?? ''}
                placeholder="resp.data.id"
                onChange={(e) => patch(index, { path: e.target.value })}
              />
            </Field>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => setItems([...items, { name: '', mode: 'text', value: '' }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar variável
      </Button>
    </div>
  );
}

/* ── Dados: notificação interna ─────────────────────────────── */
export function NotifyForm({ config, onChange }: NodeFormProps) {
  const title = String(config.title ?? '');
  const body = String(config.body ?? '');
  return (
    <div className="space-y-4">
      <Field label="Título">
        <Input value={title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Lead aguardando retorno" />
        <VariableChips onInsert={(v) => onChange({ title: `${title}${title ? ' ' : ''}${v}` })} />
      </Field>
      <Field label="Mensagem (opcional)">
        <Textarea rows={4} value={body} onChange={(e) => onChange({ body: e.target.value })} />
        <VariableChips onInsert={(v) => onChange({ body: `${body}${body ? ' ' : ''}${v}` })} />
      </Field>
      <Field label="Quem recebe">
        <Select value={String(config.audience ?? 'my_team')} onValueChange={(v) => onChange({ audience: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="my_team">Minha equipe</SelectItem>
            <SelectItem value="owners">Titulares</SelectItem>
            <SelectItem value="teams">Equipes</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nível do aviso">
        <Select value={String(config.alert_level ?? 'info')} onValueChange={(v) => onChange({ alert_level: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Informativo</SelectItem>
            <SelectItem value="notice">Atenção</SelectItem>
            <SelectItem value="alert">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
