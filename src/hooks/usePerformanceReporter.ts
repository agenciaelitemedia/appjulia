import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  startPerformanceObservers,
  collectPagePerformance,
  logPagePerformance,
} from '@/lib/clientPerformance';

const MIN_INTERVAL_MS = 60_000; // no máximo 1 envio por minuto por usuário

/**
 * Reporta métricas de performance (Web Vitals + tempos de carga + heap) para
 * `user_performance_log`, uma vez após a carga inicial e ao trocar de rota
 * (com throttle). Só atua com usuário logado; falha silenciosa.
 */
export function usePerformanceReporter(): void {
  const { user } = useAuth();
  const location = useLocation();
  const lastReportAt = useRef(0);

  // Registra observers de LCP/CLS uma única vez.
  useEffect(() => { startPerformanceObservers(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    const userId = Number(user.id);
    const clientId = user.client_id != null ? Number(user.client_id) : null;

    const report = () => {
      const now = Date.now();
      if (now - lastReportAt.current < MIN_INTERVAL_MS) return;
      lastReportAt.current = now;
      logPagePerformance({ userId, clientId, route: location.pathname, perf: collectPagePerformance() });
    };

    // Espera as métricas assentarem após a navegação.
    const t = window.setTimeout(report, 2500);

    // Captura o estado final (LCP/CLS) ao esconder a aba.
    const onHidden = () => { if (document.visibilityState === 'hidden') report(); };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [user?.id, user?.client_id, location.pathname]);
}
