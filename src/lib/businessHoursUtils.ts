interface DaySchedule {
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

export interface BusinessHoursResult {
  enabled: boolean;
  isWithinHours: boolean;
  currentDayEnabled: boolean;
  timezone: string;
  currentDay: keyof BusinessHoursSchedule | null;
  currentTime: string;
}

const DAY_MAP: Record<string, keyof BusinessHoursSchedule> = {
  'Sun': 'sunday',
  'Mon': 'monday',
  'Tue': 'tuesday',
  'Wed': 'wednesday',
  'Thu': 'thursday',
  'Fri': 'friday',
  'Sat': 'saturday'
};

export function checkBusinessHours(settings: Record<string, unknown> | null): BusinessHoursResult {
  // If settings is null or BUSINESS_HOURS_ENABLED is false, return "always open"
  if (!settings || !settings.BUSINESS_HOURS_ENABLED) {
    return {
      enabled: false,
      isWithinHours: true,
      currentDayEnabled: true,
      timezone: '',
      currentDay: null,
      currentTime: ''
    };
  }

  const timezone = (settings.BUSINESS_HOURS_TIMEZONE as string) || 'America/Sao_Paulo';
  const schedule = settings.BUSINESS_HOURS_SCHEDULE as BusinessHoursSchedule;

  if (!schedule) {
    return {
      enabled: true,
      isWithinHours: true,
      currentDayEnabled: true,
      timezone,
      currentDay: null,
      currentTime: ''
    };
  }

  // Use Intl.DateTimeFormat to get day/time in configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const now = new Date();
  const parts = formatter.formatToParts(now);

  const weekdayPart = parts.find(p => p.type === 'weekday')?.value;
  const hourPart = parts.find(p => p.type === 'hour')?.value || '00';
  const minutePart = parts.find(p => p.type === 'minute')?.value || '00';

  const currentDay = DAY_MAP[weekdayPart || 'Mon'];
  const currentTime = `${hourPart}:${minutePart}`;
  const daySchedule = schedule[currentDay];

  if (!daySchedule?.enabled) {
    return {
      enabled: true,
      isWithinHours: false,
      currentDayEnabled: false,
      timezone,
      currentDay,
      currentTime
    };
  }

  const isWithin = currentTime >= daySchedule.start && currentTime <= daySchedule.end;
  return {
    enabled: true,
    isWithinHours: isWithin,
    currentDayEnabled: true,
    timezone,
    currentDay,
    currentTime
  };
}

// Helper to get timezone label
const TIMEZONE_LABELS: Record<string, string> = {
  'America/Sao_Paulo': 'Brasília (GMT-3)',
  'America/Manaus': 'Manaus (GMT-4)',
  'America/Cuiaba': 'Cuiabá (GMT-4)',
  'America/Belem': 'Belém (GMT-3)',
  'America/Fortaleza': 'Fortaleza (GMT-3)',
  'America/Recife': 'Recife (GMT-3)',
  'America/Rio_Branco': 'Rio Branco (GMT-5)',
  'America/Porto_Velho': 'Porto Velho (GMT-4)',
};

export function getTimezoneLabel(timezone: string): string {
  return TIMEZONE_LABELS[timezone] || timezone;
}

// Day name labels in Portuguese
const DAY_LABELS: Record<keyof BusinessHoursSchedule, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export function getDayLabel(day: keyof BusinessHoursSchedule): string {
  return DAY_LABELS[day];
}

// Format schedule as grouped lines (e.g., "Segunda a Sexta: 08:00 - 18:00")
export function formatScheduleSummary(schedule: BusinessHoursSchedule): string[] {
  const days: (keyof BusinessHoursSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const lines: string[] = [];
  
  let i = 0;
  while (i < days.length) {
    const day = days[i];
    const daySchedule = schedule[day];
    
    if (!daySchedule?.enabled) {
      lines.push(`${DAY_LABELS[day]}: Fechado`);
      i++;
      continue;
    }
    
    // Find consecutive days with same schedule
    let j = i + 1;
    while (j < days.length) {
      const nextDay = days[j];
      const nextSchedule = schedule[nextDay];
      if (!nextSchedule?.enabled || 
          nextSchedule.start !== daySchedule.start || 
          nextSchedule.end !== daySchedule.end) {
        break;
      }
      j++;
    }
    
    const start = daySchedule.start;
    const end = daySchedule.end;
    
    if (j === i + 1) {
      // Single day
      lines.push(`${DAY_LABELS[day]}: ${start} - ${end}`);
    } else {
      // Range of days
      const lastDay = days[j - 1];
      lines.push(`${DAY_LABELS[day]} a ${DAY_LABELS[lastDay]}: ${start} - ${end}`);
    }
    
    i = j;
  }
  
  return lines;
}
