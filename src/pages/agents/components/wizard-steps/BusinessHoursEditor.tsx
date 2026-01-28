import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export interface BusinessHoursSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DAYS_OF_WEEK: { key: keyof BusinessHoursSchedule; label: string }[] = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

interface BusinessHoursEditorProps {
  schedule: BusinessHoursSchedule;
  onChange: (schedule: BusinessHoursSchedule) => void;
  disabled?: boolean;
}

export function BusinessHoursEditor({ schedule, onChange, disabled = false }: BusinessHoursEditorProps) {
  const handleDayToggle = (day: keyof BusinessHoursSchedule, enabled: boolean) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], enabled },
    });
  };

  const handleTimeChange = (day: keyof BusinessHoursSchedule, field: 'start' | 'end', value: string) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], [field]: value },
    });
  };

  return (
    <div className="space-y-3">
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const daySchedule = schedule[key];
        const isDisabled = disabled || !daySchedule.enabled;

        return (
          <div
            key={key}
            className={`flex items-center gap-4 p-3 rounded-lg border transition-opacity ${
              isDisabled ? 'opacity-50 bg-muted/30' : 'bg-background'
            }`}
          >
            <Checkbox
              id={`day-${key}`}
              checked={daySchedule.enabled}
              onCheckedChange={(checked) => handleDayToggle(key, checked === true)}
              disabled={disabled}
            />
            <Label
              htmlFor={`day-${key}`}
              className="flex-1 min-w-[120px] cursor-pointer font-medium"
            >
              {label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={daySchedule.start}
                onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                disabled={isDisabled}
                className="w-[120px]"
              />
              <span className="text-muted-foreground">às</span>
              <Input
                type="time"
                value={daySchedule.end}
                onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                disabled={isDisabled}
                className="w-[120px]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
