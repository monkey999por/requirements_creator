export function SaveButton({
  hasChanges,
  saving,
  onClick,
  className,
}: {
  hasChanges: boolean;
  saving: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        hasChanges
          ? "bg-indigo-600 text-white hover:bg-indigo-500"
          : "bg-gray-800 text-gray-600 cursor-not-allowed"
      } ${className ?? ""}`}
      onClick={onClick}
      disabled={!hasChanges || saving}
    >
      {saving ? "保存中..." : "保存"}
    </button>
  );
}
