import { FollowupFilters } from './FollowupFilters';
import { FollowupSummary } from './FollowupSummary';
import { FollowupEvolutionChart } from './FollowupEvolutionChart';
import { FollowupResponseRateChart } from './FollowupResponseRateChart';
import { FollowupStats, FollowupDailyMetrics } from '../../types';

interface FollowupDashboardProps {
  stats: FollowupStats;
  dailyMetrics: FollowupDailyMetrics[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function FollowupDashboard({
  stats,
  dailyMetrics,
  isLoading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: FollowupDashboardProps) {
  // Detect if it's a single day period for hourly granularity
  const granularity: 'daily' | 'hourly' = dateFrom === dateTo ? 'hourly' : 'daily';

  return (
    <div className="space-y-6">
      {/* Date filters only (no state filter on dashboard) */}
      <FollowupFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        stateFilter="all"
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onStateFilterChange={() => {}}
        showStateFilter={false}
      />
      
      {/* Summary Cards (5 cards including response rate) */}
      <FollowupSummary stats={stats} isLoading={isLoading} />
      
      {/* Evolution Chart */}
      <FollowupEvolutionChart data={dailyMetrics} isLoading={isLoading} granularity={granularity} />
      
      {/* Response Rate Chart */}
      <FollowupResponseRateChart data={dailyMetrics} isLoading={isLoading} granularity={granularity} />
    </div>
  );
}
