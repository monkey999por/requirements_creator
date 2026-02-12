import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDatasetItem,
  createDataset,
  type Dataset,
  type DatasetItem,
  fetchDatasets,
} from "../api";

interface DatasetAddButtonProps {
  item: DatasetItem;
  isDev: boolean;
}

export function DatasetAddButton({ item, isDev }: DatasetAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (open) {
      fetchDatasets().then(setDatasets);
    }
  }, [open]);

  // ドロップダウン位置をボタン位置から計算
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setNewName("");
  }, []);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  const handleAdd = useCallback(
    async (datasetName: string) => {
      const result = await addDatasetItem(datasetName, item);
      if (result.success) {
        showFeedback("追加しました");
      } else {
        showFeedback(result.error ?? "エラー");
      }
      setOpen(false);
    },
    [item, showFeedback],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const result = await createDataset(newName.trim());
    if (result.success) {
      await handleAdd(newName.trim());
    } else {
      showFeedback(result.error ?? "作成エラー");
    }
    setCreating(false);
    setNewName("");
  }, [newName, handleAdd, showFeedback]);

  if (!isDev) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="p-1 rounded-md text-gray-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        title="データセットに追加"
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

      {/* Portal: 透明オーバーレイ + ドロップダウン */}
      {createPortal(
        <AnimatePresence>
          {open && dropdownPos && (
            <>
              {/* 透明オーバーレイ: タップでドロップダウンを閉じる & リンク遷移を防止 */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay dismissal */}
              <div
                role="presentation"
                className="fixed inset-0 z-[60]"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  closeDropdown();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
              />
              <motion.div
                ref={dropdownRef}
                className="fixed z-[61] w-56 rounded-xl border border-gray-700 bg-gray-800 shadow-xl"
                style={{ top: dropdownPos.top, right: dropdownPos.right }}
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-gray-700/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    データセットに追加
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto dark-scrollbar">
                  {datasets.length === 0 && !creating && (
                    <p className="px-3 py-3 text-xs text-gray-500 text-center">
                      データセットがありません
                    </p>
                  )}
                  {datasets.map((ds) => (
                    <button
                      type="button"
                      key={ds.name}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700/50 transition-colors text-left"
                      onClick={() => handleAdd(ds.name)}
                    >
                      <svg
                        aria-hidden="true"
                        className="size-3.5 text-gray-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <span className="truncate">{ds.name}</span>
                      <span className="ml-auto text-[11px] text-gray-600">{ds.items.length}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-700/50">
                  {creating ? (
                    <div className="flex items-center gap-1 p-2">
                      <input
                        type="text"
                        className="flex-1 min-w-0 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded-md text-gray-300 outline-none focus:border-indigo-500"
                        placeholder="データセット名"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                          if (e.key === "Escape") {
                            setCreating(false);
                            setNewName("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="px-2 py-1 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                        onClick={handleCreate}
                      >
                        作成
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:bg-gray-700/50 transition-colors"
                      onClick={() => setCreating(true)}
                    >
                      <svg
                        aria-hidden="true"
                        className="size-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      新規データセット作成
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* フィードバックメッセージ（Portal） */}
      {createPortal(
        <AnimatePresence>
          {feedback && buttonRef.current && (
            <motion.div
              className="fixed z-[61] px-3 py-1.5 rounded-lg bg-gray-700 text-xs text-gray-200 whitespace-nowrap shadow-lg"
              style={{
                top: buttonRef.current.getBoundingClientRect().bottom + 4,
                right: window.innerWidth - buttonRef.current.getBoundingClientRect().right,
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
