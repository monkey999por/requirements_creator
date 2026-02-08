import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMemo, saveMemo } from "../api";
import { MarkdownPane } from "./MarkdownPane";

type MemoView = "edit" | "preview";

export function MemoTab({ isMobile, isDev }: { isMobile: boolean; isDev: boolean }) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [view, setView] = useState<MemoView>("edit");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchMemo()
      .then((r) => {
        setContent(r.content);
        setSavedContent(r.content);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasChanges = content !== savedContent;

  const handleSave = useCallback(async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    await saveMemo(content);
    setSavedContent(content);
    setSaving(false);
  }, [content, hasChanges, saving]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="size-8 rounded-full border-2 border-indigo-800 border-t-indigo-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
          <p className="text-xs text-gray-500">読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* View toggle + Save */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          {isDev && (
            <div className="flex rounded-lg bg-gray-800 p-0.5">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  view === "edit"
                    ? "bg-gray-700 text-gray-200"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                onClick={() => setView("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  view === "preview"
                    ? "bg-gray-700 text-gray-200"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                onClick={() => setView("preview")}
              >
                Preview
              </button>
            </div>
          )}
          <div className="flex-1" />
          {isDev && (
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                hasChanges
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto dark-scrollbar bg-gray-900">
          {isDev && view === "edit" ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full p-4 bg-transparent text-gray-300 text-sm font-mono resize-none outline-none placeholder:text-gray-700"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdownで入力..."
            />
          ) : (
            <div className="p-4">
              <MarkdownPane content={content || "*メモはまだありません*"} />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Desktop layout: side-by-side ── */
  return (
    <div className="flex h-full">
      {/* Editor */}
      {isDev && (
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700/50">
          <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
            <span className="px-3 py-2.5 text-xs font-medium text-indigo-400">Edit</span>
            <div className="flex-1" />
            <button
              type="button"
              className={`px-3 py-1.5 my-1 text-xs font-medium rounded-lg transition-colors ${
                hasChanges
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="flex-1 w-full p-6 bg-gray-900 text-gray-300 text-sm font-mono resize-none outline-none placeholder:text-gray-700"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Markdownで入力..."
          />
        </div>
      )}
      {/* Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
          <span className="px-3 py-2.5 text-xs font-medium text-indigo-400">Preview</span>
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
          <MarkdownPane content={content || "*メモはまだありません*"} />
        </div>
      </div>
    </div>
  );
}
