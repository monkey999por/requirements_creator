import type { FavoriteItem } from "../../api";

const TYPE_CONFIG: Record<FavoriteItem["type"], { label: string; className: string }> = {
  overview: { label: "OVR", className: "bg-blue-900/40 text-blue-400" },
  feature: { label: "FTR", className: "bg-purple-900/40 text-purple-400" },
  diagram: { label: "DGM", className: "bg-emerald-900/40 text-emerald-400" },
};

interface TypeBadgeProps {
  type: FavoriteItem["type"];
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded text-[10px] font-bold px-1.5 py-0.5 ${config.className} ${className ?? ""}`}
    >
      {config.label}
    </span>
  );
}

export function typeLabel(type: FavoriteItem["type"]): string {
  return TYPE_CONFIG[type].label;
}

export function typeBadgeClass(type: FavoriteItem["type"]): string {
  return TYPE_CONFIG[type].className;
}
