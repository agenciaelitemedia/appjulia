// Storage keys — centralized to avoid magic strings across the codebase

export const STORAGE_KEYS = {
  /** Authenticated user object */
  AUTH_USER: 'julia_user',
  /** Legacy permissions key (unused but kept for cleanup on logout) */
  AUTH_PERMISSIONS: 'julia_permissions',
  /** Selected period filter persisted across sessions */
  PERSISTED_PERIOD: 'lovable-quick-period',
  /** Agents list filter state */
  AGENTS_LIST_FILTERS: 'agents-list-filters',
  /** DataJud search history */
  DATAJUD_SEARCH_HISTORY: 'datajud_search_history',
} as const;
