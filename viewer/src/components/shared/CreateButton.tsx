export function CreateButton({
  onClick,
  title,
  hoverClassName = "hover:text-indigo-400 hover:bg-indigo-500/10",
}: {
  onClick: () => void;
  title?: string;
  hoverClassName?: string;
}) {
  return (
    <button
      type="button"
      className={`p-1.5 rounded-lg text-gray-400 ${hoverClassName} transition-colors`}
      onClick={onClick}
      title={title}
    >
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}
