import { Play } from "lucide-react";

import { OptimizedImage } from "~/core/components/ui/optimized-image";
import { cn } from "~/core/lib/utils";

interface WorkflowThumbnailProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  duration?: string;
  className?: string;
  priority?: boolean;
}

const sizeConfig = {
  sm: { width: 64, height: 64, iconSize: "size-3", textSize: "text-[10px]" },
  md: { width: 96, height: 96, iconSize: "size-6", textSize: "text-xs" },
  lg: { width: 160, height: 90, iconSize: "size-8", textSize: "text-sm" },
};

export function WorkflowThumbnail({
  src,
  alt,
  size = "sm",
  duration,
  className,
  priority = false,
}: WorkflowThumbnailProps) {
  const config = sizeConfig[size];

  // 썸네일 없을 때 placeholder
  if (!src) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800",
          className,
        )}
        style={{ width: config.width, height: config.height }}
      >
        <div className="rounded-full bg-white/80 p-1.5 shadow-sm dark:bg-slate-700/80">
          <Play
            className={cn(
              config.iconSize,
              "fill-slate-900 text-slate-900 dark:fill-slate-100 dark:text-slate-100",
            )}
          />
        </div>
        {duration && (
          <div
            className={cn(
              "absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-white",
              config.textSize,
            )}
          >
            {duration}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg", className)}
      style={{ width: config.width, height: config.height }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        width={config.width}
        height={config.height}
        priority={priority}
        className="h-full w-full"
      />
      {duration && (
        <div
          className={cn(
            "absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-white",
            config.textSize,
          )}
        >
          {duration}
        </div>
      )}
    </div>
  );
}
