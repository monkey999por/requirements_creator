import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  type FavoriteItem,
  fetchDiagrams,
  fetchFavorites,
  fetchFeatureDetail,
  fetchOverview,
  removeFavorite,
} from "../api";
import { DatasetAddButton } from "./DatasetAddButton";
import { MarkdownPane } from "./MarkdownPane";

interface FavoritePageProps {
  isMobile: boolean;
  isDev: boolean;
  onSelectApp: (appName: string) => void;
  onSelectFeature: (appName: string, featureId: string) => void;
  onSelectDiagram: (appName: string) => void;
  onRefresh?: () => void;
}

interface GroupedFavorites {
  appName: string;
  items: FavoriteItem[];
}

function groupByApp(items: FavoriteItem[]): GroupedFavorites[] {
  const map = new Map<string, FavoriteItem[]>();
  for (const item of items) {
    const list = map.get(item.appName) ?? [];
    list.push(item);
    map.set(item.appName, list);
  }
  return Array.from(map.entries()).map(([appName, items]) => ({ appName, items }));
}

function typeLabel(type: FavoriteItem["type"]): string {
  switch (type) {
    case "overview":
      return "OVR";
    case "feature":
      return "FTR";
    case "diagram":
      return "DGM";
  }
}

function typeBadgeClass(type: FavoriteItem["type"]): string {
  switch (type) {
    case "overview":
      return "bg-blue-900/40 text-blue-400";
    case "feature":
      return "bg-purple-900/40 text-purple-400";
    case "diagram":
      return "bg-emerald-900/40 text-emerald-400";
  }
}

function toDatasetItem(fav: FavoriteItem) {
  return {
    appName: fav.appName,
    type: fav.type === "diagram" ? ("overview" as const) : (fav.type as "overview" | "feature"),
    featureId: fav.featureId,
    title: fav.title,
  };
}

function itemKey(item: FavoriteItem): string {
  return `${item.appName}-${item.type}-${item.featureId ?? ""}-${item.diagramId ?? ""}`;
}

async function fetchPreviewContent(item: FavoriteItem): Promise<string> {
  switch (item.type) {
    case "overview": {
      const res = await fetchOverview(item.appName);
      return res.content;
    }
    case "feature": {
      if (!item.featureId) return "";
      const res = await fetchFeatureDetail(item.appName, item.featureId);
      return res.content;
    }
    case "diagram": {
      if (!item.diagramId) return "";
      const diagrams = await fetchDiagrams(item.appName);
      const found = diagrams.find((d) => d.id === item.diagramId);
      return found?.content ?? "";
    }
  }
}

export function FavoritePage({
  isMobile,
  isDev,
  onSelectApp,
  onSelectFeature,
  onSelectDiagram,
  onRefresh,
}: FavoritePageProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<FavoriteItem | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchFavorites()
      .then(setFavorites)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = useCallback(
    async (item: FavoriteItem) => {
      await removeFavorite(item);
      setFavorites((prev) =>
        prev.filter(
          (f) =>
            !(
              f.appName === item.appName &&
              f.type === item.type &&
              f.featureId === item.featureId &&
              f.diagramId === item.diagramId
            ),
        ),
      );
      if (previewItem && itemKey(previewItem) === itemKey(item)) {
        setPreviewItem(null);
        setPreviewContent("");
      }
      onRefresh?.();
    },
    [onRefresh, previewItem],
  );

  const handlePreview = useCallback(
    async (item: FavoriteItem) => {
      if (previewItem && itemKey(previewItem) === itemKey(item)) {
        setPreviewItem(null);
        setPreviewContent("");
        return;
      }
      setPreviewItem(item);
      setPreviewContent("");
      setPreviewLoading(true);
      try {
        const content = await fetchPreviewContent(item);
        setPreviewContent(content);
      } finally {
        setPreviewLoading(false);
      }
    },
    [previewItem],
  );

  const closePreview = useCallback(() => {
    setPreviewItem(null);
    setPreviewContent("");
  }, []);

  const grouped = groupByApp(favorites);

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
            className="size-8 rounded-full border-2 border-pink-800 border-t-pink-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
          <p className="text-xs text-gray-500">読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Mobile: preview replaces list ── */
  if (isMobile && previewItem) {
    return (
      <motion.div
        className="flex flex-col h-full"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2 px-4 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
            onClick={closePreview}
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold px-1.5 py-0.5 ${typeBadgeClass(previewItem.type)}`}
          >
            {typeLabel(previewItem.type)}
          </span>
          <span className="text-xs font-medium text-gray-300 py-2.5 truncate">
            {previewItem.title ?? previewItem.appName}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-8 bg-gray-900">
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                className="size-6 rounded-full border-2 border-gray-700 border-t-gray-400"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              />
            </div>
          ) : (
            <MarkdownPane content={previewContent} />
          )}
        </div>
      </motion.div>
    );
  }

  const listContent = (
    <>
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="size-14 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg
              className="size-7 text-gray-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500">お気に入りがありません</p>
          <p className="text-xs text-gray-600 mt-1">
            アプリのハートアイコンからお気に入りに追加できます
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {grouped.map((group) => (
              <motion.section
                key={group.appName}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                {/* App header */}
                <button
                  type="button"
                  className="flex items-center gap-2 mb-3 group"
                  onClick={() => onSelectApp(group.appName)}
                >
                  <span className="inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold px-1.5 py-0.5 bg-indigo-900/40 text-indigo-400">
                    APP
                  </span>
                  <span className="text-sm font-semibold text-gray-200 group-hover:text-indigo-300 transition-colors truncate">
                    {group.appName}
                  </span>
                  <svg
                    className="size-3.5 text-gray-600 group-hover:text-indigo-400 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Items */}
                <div className="space-y-1.5 ml-2">
                  <AnimatePresence>
                    {group.items.map((item) => {
                      const key = itemKey(item);
                      const isActive = previewItem != null && itemKey(previewItem) === key;
                      return (
                        <motion.div
                          key={key}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border group/item ${
                            isActive
                              ? "bg-indigo-500/10 border-indigo-500/30"
                              : "bg-gray-800/60 border-gray-700/30"
                          }`}
                        >
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold px-1.5 py-0.5 ${typeBadgeClass(item.type)}`}
                          >
                            {typeLabel(item.type)}
                          </span>
                          <button
                            type="button"
                            className="flex-1 text-xs text-gray-300 truncate text-left hover:text-indigo-300 transition-colors"
                            onClick={() => {
                              if (item.type === "feature" && item.featureId) {
                                onSelectFeature(item.appName, item.featureId);
                              } else if (item.type === "diagram") {
                                onSelectDiagram(item.appName);
                              } else {
                                onSelectApp(item.appName);
                              }
                            }}
                          >
                            {item.title ?? item.appName}
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Preview button */}
                            <button
                              type="button"
                              className={`p-1 rounded-md transition-colors ${
                                isActive
                                  ? "text-indigo-400 bg-indigo-400/10"
                                  : "text-gray-600 hover:text-indigo-400 hover:bg-indigo-400/10 opacity-0 group-hover/item:opacity-100"
                              }`}
                              onClick={() => handlePreview(item)}
                              title="プレビュー"
                            >
                              <svg
                                className="size-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </button>
                            {isDev && <DatasetAddButton item={toDatasetItem(item)} isDev={isDev} />}
                            <button
                              type="button"
                              className="p-1 rounded-md text-gray-600 hover:text-pink-400 hover:bg-pink-400/10 transition-colors opacity-0 group-hover/item:opacity-100"
                              onClick={() => handleRemove(item)}
                              title="お気に入りから削除"
                            >
                              <svg
                                className="size-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
        <svg
          className="size-5 text-pink-400"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
        <div>
          <h2 className="text-sm font-bold text-gray-200">お気に入り</h2>
          <p className="text-[10px] text-gray-500">{favorites.length} 件のお気に入り</p>
        </div>
      </div>

      {/* Body: list + preview pane */}
      <div className="flex flex-1 min-h-0">
        {/* List pane */}
        <div
          className={`overflow-y-auto dark-scrollbar ${isMobile ? "p-4 pb-8" : "p-6"} bg-gray-900 ${
            previewItem && !isMobile ? "border-r border-gray-700/50" : ""
          }`}
          style={{ flex: previewItem && !isMobile ? "0 0 50%" : "1 1 100%" }}
        >
          {listContent}
        </div>

        {/* Preview pane (desktop only) */}
        {!isMobile && (
          <AnimatePresence>
            {previewItem && (
              <motion.div
                key="preview"
                className="flex flex-col min-w-0 bg-gray-900"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "50%", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Preview header */}
                <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
                  <span
                    className={`inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold px-1.5 py-0.5 ${typeBadgeClass(previewItem.type)}`}
                  >
                    {typeLabel(previewItem.type)}
                  </span>
                  <span className="flex-1 text-xs font-medium text-gray-300 py-2.5 truncate">
                    {previewItem.title ?? previewItem.appName}
                  </span>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                    onClick={closePreview}
                    title="閉じる"
                  >
                    <svg
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                {/* Preview content */}
                <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
                  <AnimatePresence mode="wait">
                    {previewLoading ? (
                      <motion.div
                        key="loading"
                        className="flex items-center justify-center py-12"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="size-6 rounded-full border-2 border-gray-700 border-t-gray-400"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                          }}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key={itemKey(previewItem)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <MarkdownPane content={previewContent} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
