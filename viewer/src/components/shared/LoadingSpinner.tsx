import { motion } from "motion/react";

interface LoadingSpinnerProps {
  message?: string;
  borderColor?: string;
  borderTopColor?: string;
}

export function LoadingSpinner({
  message = "読み込み中...",
  borderColor = "border-indigo-800",
  borderTopColor = "border-t-indigo-400",
}: LoadingSpinnerProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className={`size-8 rounded-full border-2 ${borderColor} ${borderTopColor}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
        <p className="text-xs text-gray-500">{message}</p>
      </motion.div>
    </div>
  );
}
