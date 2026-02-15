import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { XIcon } from "./shared/Icons";

interface ToastData {
  title: string;
  output: string;
  success: boolean;
}

interface ToastContextValue {
  showToast: (data: ToastData) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((data: ToastData) => {
    setToast(data);
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.success ? 8000 : 15000;
    const timer = setTimeout(dismiss, ms);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toast && <ToastComponent toast={toast} onDismiss={dismiss} />}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

function ToastComponent({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border shadow-2xl shadow-black/50 overflow-hidden"
      style={{
        borderColor: toast.success ? "#374151" : "#7f1d1d",
        backgroundColor: toast.success ? "#111827" : "#1c1017",
      }}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
        <span
          className={`text-xs font-semibold ${toast.success ? "text-green-400" : "text-red-400"}`}
        >
          {toast.title}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
          onClick={onDismiss}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {/* Output */}
      <div className="max-h-60 overflow-y-auto dark-scrollbar p-4">
        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
          {highlightOutput(toast.output)}
        </pre>
      </div>
    </motion.div>
  );
}

function highlightOutput(output: string): React.ReactNode {
  return output.split("\n").map((line, i) => {
    let className = "text-gray-300";
    if (line.startsWith("$ ")) {
      className = "text-indigo-400 font-semibold";
    } else if (/error|fatal|rejected|failed/i.test(line)) {
      className = "text-red-400";
    } else if (/warning|nothing to commit/i.test(line)) {
      className = "text-yellow-400";
    } else if (/create mode|delete mode|->|=>/i.test(line)) {
      className = "text-cyan-400";
    } else if (/\d+ files? changed|insertions?|deletions?/i.test(line)) {
      className = "text-green-400";
    }
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: static log output, never reordered
      <div key={i} className={className}>
        {line || "\u00A0"}
      </div>
    );
  });
}
