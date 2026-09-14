import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MascoteLoader } from "@/components/ui/mascote-loader";
import { cn } from "@/lib/utils";

/**
 * Indicador global de navegação: barra fina no topo assim que uma navegação
 * começa e, se demorar mais de 250ms, o mascote da Julia centralizado.
 */
export function NavigationProgress() {
  const isNavigating = useRouterState({
    select: (s: any) => s.status === "pending" || s.isLoading === true || s.isTransitioning === true,
  }) as unknown as boolean;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMascote, setShowMascote] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current.forEach((id) => window.clearInterval(id));
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();

    if (isNavigating) {
      setVisible(true);
      setProgress(12);
      const tick = window.setInterval(() => {
        setProgress((p) => (p >= 90 ? 90 : p + Math.max(1, (90 - p) * 0.12)));
      }, 180);
      const mascote = window.setTimeout(() => setShowMascote(true), 250);
      timers.current.push(tick, mascote);
    } else {
      setShowMascote(false);
      setProgress(100);
      const hide = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 280);
      timers.current.push(hide);
    }

    return clearTimers;
  }, [isNavigating]);

  return (
    <>
      <div
        aria-hidden={!visible}
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5",
          visible ? "opacity-100" : "opacity-0",
          "transition-opacity duration-200",
        )}
      >
        <div
          className="h-full bg-brand-gradient transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {showMascote && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[99] grid place-items-center"
        >
          <div className="rounded-2xl bg-background/70 p-6 backdrop-blur-sm shadow-lg">
            <MascoteLoader size="md" label="Carregando…" />
          </div>
        </div>
      )}
    </>
  );
}

export default NavigationProgress;
