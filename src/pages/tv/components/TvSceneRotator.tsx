import { useEffect, useState } from 'react';

interface Scene {
  key: string;
  title: string;
  node: React.ReactNode;
}

const ROTATION_MS = 30_000;

/**
 * Faz fade entre cenas a cada 30s (ROTATION_MS).
 * Pausa rotação quando o mouse passa em cima (hover).
 */
export function TvSceneRotator({ scenes }: { scenes: Scene[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || scenes.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % scenes.length), ROTATION_MS);
    return () => clearInterval(t);
  }, [paused, scenes.length]);

  if (scenes.length === 0) return null;
  const active = scenes[idx];

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Indicador de cena + dots */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-zinc-100">{active.title}</h2>
        <div className="flex items-center gap-2">
          {scenes.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'w-12 bg-violet-500' : 'w-2 bg-zinc-700 hover:bg-zinc-600'
              }`}
              aria-label={s.title}
            />
          ))}
          {paused && <span className="text-xs text-zinc-500 ml-2 uppercase">pausado</span>}
        </div>
      </div>

      {/* Cena ativa com fade */}
      <div key={active.key} className="flex-1 min-h-0 animate-in fade-in duration-500">
        {active.node}
      </div>
    </div>
  );
}
