import { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { QUEUE_STATES } from '../../types';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { 
  QuickPeriod, 
  detectQuickPeriod, 
  calculatePeriodDates, 
  savePeriod 
} from '@/hooks/usePersistedPeriod';

interface FollowupFiltersProps {
  dateFrom: string;
  dateTo: string;
  stateFilter: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onStateFilterChange: (state: string) => void;
  showStateFilter?: boolean;
}

const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 Dias' },
  { value: 'thisMonth', label: 'Mês Atual' },
  { value: 'previousMonth', label: 'Mês Anterior' },
  { value: 'last3Months', label: '3 Meses' },
  { value: 'thisYear', label: 'Ano Atual' },
];

export function FollowupFilters({
  dateFrom,
  dateTo,
  stateFilter,
  onDateFromChange,
  onDateToChange,
  onStateFilterChange,
  showStateFilter = true,
}: FollowupFiltersProps) {
  const today = getTodayInSaoPaulo();
  
  // Determine current quick period
  const currentQuickPeriod = detectQuickPeriod(dateFrom, dateTo);

  // Save period to localStorage when it changes
  useEffect(() => {
    savePeriod(currentQuickPeriod);
  }, [currentQuickPeriod]);

  const handleQuickPeriod = (period: QuickPeriod) => {
    const { dateFrom: newDateFrom, dateTo: newDateTo } = calculatePeriodDates(period);
    savePeriod(period);
    onDateFromChange(newDateFrom);
    onDateToChange(newDateTo);
  };

  const handleClearFilters = () => {
    onDateFromChange(today);
    onDateToChange(today);
    onStateFilterChange('all');
  };

  const formatDateForDisplay = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros:</span>
      </div>

      {/* Quick Period Buttons */}
      <div className="flex gap-1">
        {QUICK_PERIODS.map((period) => (
          <Button
            key={period.value}
            variant={currentQuickPeriod === period.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickPeriod(period.value)}
          >
            {period.label}
          </Button>
        ))}
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-[130px] justify-start text-left font-normal',
                !dateFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? formatDateForDisplay(dateFrom) : 'Selecione'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom ? parseISO(dateFrom) : undefined}
              onSelect={(date) => date && onDateFromChange(format(date, 'yyyy-MM-dd'))}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-[130px] justify-start text-left font-normal',
                !dateTo && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? formatDateForDisplay(dateTo) : 'Selecione'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo ? parseISO(dateTo) : undefined}
              onSelect={(date) => date && onDateToChange(format(date, 'yyyy-MM-dd'))}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* State Filter */}
      {showStateFilter && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={stateFilter} onValueChange={onStateFilterChange}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(QUEUE_STATES).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Clear Button */}
      <Button variant="ghost" size="sm" onClick={handleClearFilters}>
        Limpar
      </Button>
    </div>
  );
}
