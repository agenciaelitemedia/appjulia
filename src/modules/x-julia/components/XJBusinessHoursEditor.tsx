import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  XJ_WEEKDAYS,
  type XJSchedule,
  type XJWeekday,
} from '../lib/xjBusinessHours';

interface Props {
  schedule: XJSchedule;
  onChange: (schedule: XJSchedule) => void;
  disabled?: boolean;
}

export function XJBusinessHoursEditor({ schedule, onChange, disabled }: Props) {
  const [bulkDays, setBulkDays] = useState<XJWeekday[]>([]);

  const patchDay = (day: XJWeekday, patch: Partial<XJSchedule[XJWeekday]>) =>
    onChange({ ...schedule, [day]: { ...schedule[day], ...patch } });

  const addRange = (day: XJWeekday) =>
    patchDay(day, { ranges: [...(schedule[day]?.ranges ?? []), { start: '00:00', end: '23:59' }] });

  const removeRange = (day: XJWeekday, index: number) =>
    patchDay(day, { ranges: (schedule[day]?.ranges ?? []).filter((_, i) => i !== index) });

  const setRange = (day: XJWeekday, index: number, field: 'start' | 'end', value: string) =>
    patchDay(day, {
      ranges: (schedule[day]?.ranges ?? []).map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    });

  const applyToSelected = (source: XJWeekday) => {
    if (!bulkDays.length) return;
    const next = { ...schedule };
    for (const day of bulkDays) {
      next[day] = {
        enabled: schedule[source].enabled,
        ranges: schedule[source].ranges.map((r) => ({ ...r })),
      };
    }
    onChange(next);
    setBulkDays([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <span className="text-xs font-medium text-muted-foreground">Aplicar a vários dias:</span>
        {XJ_WEEKDAYS.map(({ key, short }) => {
          const active = bulkDays.includes(key);
          return (
            <Badge
              key={key}
              variant={active ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() =>
                !disabled &&
                setBulkDays((prev) => (active ? prev.filter((d) => d !== key) : [...prev, key]))
              }
            >
              {short}
              {active && <X className="ml-1 h-3 w-3" />}
            </Badge>
          );
        })}
        <span className="text-xs text-muted-foreground">
          selecione os dias e clique em "Aplicar aqui" no dia modelo
        </span>
      </div>

      {XJ_WEEKDAYS.map(({ key, label }) => {
        const day = schedule[key] ?? { enabled: false, ranges: [] };
        const dayDisabled = disabled || !day.enabled;
        return (
          <div key={key} className={`space-y-2 rounded-lg border p-3 ${day.enabled ? '' : 'bg-muted/30 opacity-70'}`}>
            <div className="flex items-center gap-3">
              <Checkbox
                id={`xj-day-${key}`}
                checked={day.enabled}
                onCheckedChange={(v) => patchDay(key, { enabled: v === true })}
                disabled={disabled}
              />
              <Label htmlFor={`xj-day-${key}`} className="flex-1 cursor-pointer font-medium">
                {label}
              </Label>
              {!!bulkDays.length && !disabled && (
                <Button type="button" size="sm" variant="ghost" onClick={() => applyToSelected(key)}>
                  Aplicar aqui
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addRange(key)}
                disabled={dayDisabled}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Faixa
              </Button>
            </div>

            {day.enabled && (
              <div className="space-y-2 pl-7">
                {day.ranges.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma faixa — o agente não atua neste dia.</p>
                )}
                {day.ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-[120px]"
                      value={range.start}
                      onChange={(e) => setRange(key, index, 'start', e.target.value)}
                      disabled={dayDisabled}
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      className="w-[120px]"
                      value={range.end}
                      onChange={(e) => setRange(key, index, 'end', e.target.value)}
                      disabled={dayDisabled}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => removeRange(key, index)}
                      disabled={dayDisabled}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
