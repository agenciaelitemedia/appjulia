import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import pose1 from "@/assets/julia-mascote-acenando.png.asset.json";
import pose2 from "@/assets/julia-mascote-pose2.png.asset.json";
import pose3 from "@/assets/julia-mascote-pose3.png.asset.json";

const POSES = [pose1.url, pose2.url, pose3.url];

const SIZES = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
} as const;

interface MascoteLoaderProps {
  /** Tamanho do mascote */
  size?: keyof typeof SIZES;
  /** Texto opcional exibido abaixo */
  label?: string;
  className?: string;
  /** Ocupa a área toda e centraliza */
  fullscreen?: boolean;
}

/**
 * Spinner da marca: o mascote da Julia flutuando e alternando de pose,
 * com um anel gradiente girando ao redor.
 */
export function MascoteLoader({
  size = "md",
  label,
  className,
  fullscreen = false,
}: MascoteLoaderProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % POSES.length);
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative grid place-items-center">
        {/* halo pulsante */}
        <span className="absolute inset-0 -m-2 rounded-full bg-brand-gradient opacity-25 blur-xl animate-pulse" />

        {/* anel gradiente girando */}
        <span
          className={cn(
            "absolute -m-2 rounded-full animate-spin",
            SIZES[size],
          )}
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(var(--brand-magenta)) 200deg, hsl(var(--brand-violet)) 320deg, transparent 360deg)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          }}
          aria-hidden
        />

        {/* mascote alternando poses */}
        <div className={cn("relative", SIZES[size])}>
          {POSES.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              aria-hidden={i !== index}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
                i === index ? "opacity-100" : "opacity-0",
              )}
              style={{ animation: "aj-float 2.4s ease-in-out infinite" }}
            />
          ))}
        </div>
      </div>

      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : (
        <span className="sr-only">Carregando…</span>
      )}
    </div>
  );

  if (!fullscreen) return content;

  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center p-8">
      {content}
    </div>
  );
}

export default MascoteLoader;
