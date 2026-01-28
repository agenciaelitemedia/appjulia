import { useCallback, useEffect } from 'react';
import {
  getTodayInSaoPaulo,
  getYesterdayInSaoPaulo,
  get7DaysAgoInSaoPaulo,
  get3MonthsAgoInSaoPaulo,
  getFirstDayOfMonthInSaoPaulo,
  getLastDayOfMonthInSaoPaulo,
  getFirstDayOfPreviousMonthInSaoPaulo,
  getLastDayOfPreviousMonthInSaoPaulo,
  getFirstDayOfYearInSaoPaulo,
} from '@/lib/dateUtils';

export type QuickPeriod = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'previousMonth' | 'last3Months' | 'thisYear' | 'custom';

const STORAGE_KEY = 'lovable-quick-period';

export interface PeriodDates {
  dateFrom: string;
  dateTo: string;
}

/**
 * Calculate dates for a given quick period
 */
export function calculatePeriodDates(period: QuickPeriod): PeriodDates {
  const today = getTodayInSaoPaulo();

  switch (period) {
    case 'today':
      return { dateFrom: today, dateTo: today };
    case 'yesterday': {
      const yesterday = getYesterdayInSaoPaulo();
      return { dateFrom: yesterday, dateTo: yesterday };
    }
    case 'last7days':
      return { dateFrom: get7DaysAgoInSaoPaulo(), dateTo: today };
    case 'thisMonth':
      return { dateFrom: getFirstDayOfMonthInSaoPaulo(), dateTo: getLastDayOfMonthInSaoPaulo() };
    case 'previousMonth':
      return { dateFrom: getFirstDayOfPreviousMonthInSaoPaulo(), dateTo: getLastDayOfPreviousMonthInSaoPaulo() };
    case 'last3Months':
      return { dateFrom: get3MonthsAgoInSaoPaulo(), dateTo: today };
    case 'thisYear':
      return { dateFrom: getFirstDayOfYearInSaoPaulo(), dateTo: today };
    default:
      return { dateFrom: today, dateTo: today };
  }
}

/**
 * Detect which quick period matches the given date range
 */
export function detectQuickPeriod(dateFrom: string, dateTo: string): QuickPeriod {
  const today = getTodayInSaoPaulo();
  const yesterday = getYesterdayInSaoPaulo();
  const last7days = get7DaysAgoInSaoPaulo();
  const last3Months = get3MonthsAgoInSaoPaulo();
  const thisMonthStart = getFirstDayOfMonthInSaoPaulo();
  const thisMonthEnd = getLastDayOfMonthInSaoPaulo();
  const prevMonthStart = getFirstDayOfPreviousMonthInSaoPaulo();
  const prevMonthEnd = getLastDayOfPreviousMonthInSaoPaulo();
  const thisYearStart = getFirstDayOfYearInSaoPaulo();

  if (dateFrom === today && dateTo === today) return 'today';
  if (dateFrom === yesterday && dateTo === yesterday) return 'yesterday';
  if (dateFrom === last7days && dateTo === today) return 'last7days';
  if (dateFrom === thisMonthStart && dateTo === thisMonthEnd) return 'thisMonth';
  if (dateFrom === prevMonthStart && dateTo === prevMonthEnd) return 'previousMonth';
  if (dateFrom === last3Months && dateTo === today) return 'last3Months';
  if (dateFrom === thisYearStart && dateTo === today) return 'thisYear';
  return 'custom';
}

/**
 * Get the saved period from localStorage
 */
export function getSavedPeriod(): QuickPeriod {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['today', 'yesterday', 'last7days', 'thisMonth', 'previousMonth', 'last3Months', 'thisYear'].includes(saved)) {
      return saved as QuickPeriod;
    }
  } catch {
    // localStorage not available
  }
  return 'today';
}

/**
 * Save period to localStorage
 */
export function savePeriod(period: QuickPeriod): void {
  try {
    if (period !== 'custom') {
      localStorage.setItem(STORAGE_KEY, period);
    }
  } catch {
    // localStorage not available
  }
}

/**
 * Get initial dates based on saved period
 */
export function getInitialDates(): PeriodDates {
  const savedPeriod = getSavedPeriod();
  return calculatePeriodDates(savedPeriod);
}

/**
 * Hook to persist the selected quick period in localStorage
 * Automatically saves when the period changes and provides initial dates
 */
export function usePersistedPeriod(
  dateFrom: string,
  dateTo: string,
  onDatesChange?: (dates: PeriodDates) => void
) {
  const currentPeriod = detectQuickPeriod(dateFrom, dateTo);

  // Save period to localStorage when it changes (only for predefined periods)
  useEffect(() => {
    savePeriod(currentPeriod);
  }, [currentPeriod]);

  // Handler to apply a quick period
  const applyPeriod = useCallback((period: QuickPeriod) => {
    const dates = calculatePeriodDates(period);
    savePeriod(period);
    onDatesChange?.(dates);
    return dates;
  }, [onDatesChange]);

  return {
    currentPeriod,
    applyPeriod,
  };
}
