import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMemo, saveMemo } from "../api";
import { MarkdownPane } from "./MarkdownPane";
import { LoadingSpinner } from "./shared/LoadingSpinner";
import { SaveButton } from "./shared/SaveButton";

type MemoView = "edit" | "preview";

export function MemoTab({
  appName,
  isMobile,
  isDev,
}: {
  appName: string;
  isMobile: boolean;
  isDev: boolean;
}) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [view, setView] = useState<MemoView>("edit");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchMemo(appName)
      .then((r) => {
        setContent(r.content);
        setSavedContent(r.content);
      })
      .finally(() => setLoading(false));
  }, [appName]);

  const hasChanges = content !== savedContent;

  const handleSave = useCallback(async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    await saveMemo(appName, content);
    setSavedContent(content);
    setSaving(false);
  }, [appName, content, hasChanges, saving]);

  if (loading) {
    return <LoadingSpinner />;
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
          {isDev && <SaveButton hasChanges={hasChanges} saving={saving} onClick={handleSave} />}
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
            <div className="p-4 pb-8">
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
            <SaveButton
              hasChanges={hasChanges}
              saving={saving}
              onClick={handleSave}
              className="my-1"
            />
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
