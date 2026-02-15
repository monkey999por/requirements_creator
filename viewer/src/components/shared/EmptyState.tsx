interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  submessage?: string;
  className?: string;
  iconClassName?: string;
}

export function EmptyState({
  icon,
  message,
  submessage,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div className={className ?? "py-12 text-center"}>
      <div
        className={
          iconClassName ??
          "size-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center"
        }
      >
        {icon}
      </div>
      <p className="text-gray-600 text-xs">{message}</p>
      {submessage && <p className="text-gray-700 text-[11px] mt-1">{submessage}</p>}
    </div>
  );
}
