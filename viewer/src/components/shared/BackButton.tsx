import { ChevronLeftIcon } from "./Icons";

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
      onClick={onClick}
    >
      <ChevronLeftIcon />
    </button>
  );
}
