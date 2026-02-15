import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  createDataset,
  type Dataset,
  type DatasetItem,
  deleteDataset,
  fetchDatasets,
  fetchDiagrams,
  fetchFeatureDetail,
  fetchGeneratedAppsFromDataset,
  fetchOverview,
  removeDatasetItem,
} from "../api";
import { useMessageToast } from "../hooks/useMessageToast";
import { MarkdownPane } from "./MarkdownPane";
import { BackButton } from "./shared/BackButton";
import { CreateButton } from "./shared/CreateButton";
import { EmptyState } from "./shared/EmptyState";
import { TrashIcon, XIcon } from "./shared/Icons";
import { LoadingSpinner } from "./shared/LoadingSpinner";
import { MessageToast } from "./shared/MessageToast";
import { TypeBadge } from "./shared/TypeBadge";

function itemKey(item: DatasetItem): string {
  return `${item.appName}-${item.type}-${item.featureId ?? ""}-${item.diagramId ?? ""}`;
}

async function fetchPreviewContent(item: DatasetItem): Promise<string> {
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

export function DatasetManager({
  isMobile,
  isDev,
  onSelectApp,
  onSelectFeature,
  onSelectDiagram,
  initialSelected,
  generating,
  generatingDataset,
  generatingMessage,
  onGenerate,
}: {
  isMobile: boolean;
  isDev: boolean;
  onSelectApp?: (appName: string) => void;
  onSelectFeature?: (appName: string, featureId: string) => void;
  onSelectDiagram?: (appName: string) => void;
  initialSelected?: string | null;
  generating: boolean;
  generatingDataset: string | null;
  generatingMessage: string | null;
  onGenerate: (datasetName: string) => void;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const { message, showMessage } = useMessageToast();

  // Preview state
  const [previewItem, setPreviewItem] = useState<DatasetItem | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const reload = useCallback(() => {
    fetchDatasets()
      .then(setDatasets)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (initialSelected) setSelected(initialSelected);
  }, [initialSelected]);

  const selectedDataset = datasets.find((d) => d.name === selected);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const result = await createDataset(newName.trim());
    if (result.success) {
      setCreating(false);
      setNewName("");
      reload();
      setSelected(newName.trim());
    } else {
      showMessage(result.error ?? "作成エラー");
    }
  }, [newName, reload, showMessage]);

  const handleDelete = useCallback(
    async (name: string) => {
      await deleteDataset(name);
      if (selected === name) setSelected(null);
      reload();
    },
    [selected, reload],
  );

  const handleRemoveItem = useCallback(
    async (item: DatasetItem) => {
      if (!selected) return;
      await removeDatasetItem(selected, item);
      if (previewItem && itemKey(previewItem) === itemKey(item)) {
        setPreviewItem(null);
        setPreviewContent("");
      }
      reload();
    },
    [selected, reload, previewItem],
  );

  const handlePreview = useCallback(
    async (item: DatasetItem) => {
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

  const handleNavigateItem = useCallback(
    (item: DatasetItem) => {
      if (item.type === "feature" && item.featureId && onSelectFeature) {
        onSelectFeature(item.appName, item.featureId);
      } else if (item.type === "diagram" && onSelectDiagram) {
        onSelectDiagram(item.appName);
      } else if (onSelectApp) {
        onSelectApp(item.appName);
      }
    },
    [onSelectApp, onSelectFeature, onSelectDiagram],
  );

  const isGeneratingThis = generating && generatingDataset === selected;

  const handleGenerateClick = useCallback(() => {
    if (selected) onGenerate(selected);
  }, [selected, onGenerate]);

  if (loading) {
    return <LoadingSpinner />;
  }

  /* Mobile layout */
  if (isMobile) {
    // Mobile preview
    if (previewItem) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-center gap-2 px-4 bg-gray-900 border-b border-gray-800 shrink-0">
            <BackButton onClick={closePreview} />
            <TypeBadge type={previewItem.type} />
            <span className="text-xs font-medium text-gray-300 py-2.5 truncate">
              {previewItem.title ?? previewItem.appName}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
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

    if (selectedDataset) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <DatasetDetailHeader
            dataset={selectedDataset}
            onBack={() => setSelected(null)}
            onGenerate={handleGenerateClick}
            generating={isGeneratingThis}
            isDev={isDev}
            isMobile
          />
          <DatasetItemList
            dataset={selectedDataset}
            onRemove={handleRemoveItem}
            isDev={isDev}
            onSelectApp={onSelectApp}
            onPreview={handlePreview}
            previewItem={previewItem}
            onNavigateItem={handleNavigateItem}
          />
          <MessageToast message={generatingMessage ?? message} />
        </motion.div>
      );
    }
    return (
      <motion.div
        className="flex flex-col h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">データセット</h2>
          <div className="flex-1" />
          {isDev && <CreateButton onClick={() => setCreating(true)} title="新規データセット作成" />}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
          <CreateForm
            show={creating}
            name={newName}
            onNameChange={setNewName}
            onCreate={handleCreate}
            onCancel={() => {
              setCreating(false);
              setNewName("");
            }}
          />
          <DatasetList
            datasets={datasets}
            selected={selected}
            onSelect={setSelected}
            onDelete={handleDelete}
            isDev={isDev}
          />
        </div>
        <MessageToast message={generatingMessage ?? message} />
      </motion.div>
    );
  }

  /* Desktop layout */
  return (
    <motion.div
      className="flex h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Left: dataset list */}
      <div className="w-72 flex flex-col border-r border-gray-700/50 shrink-0">
        <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
          <span className="px-3 py-2.5 text-xs font-medium text-indigo-400">データセット</span>
          <div className="flex-1" />
          {isDev && <CreateButton onClick={() => setCreating(true)} title="新規データセット作成" />}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-3 bg-gray-900">
          <CreateForm
            show={creating}
            name={newName}
            onNameChange={setNewName}
            onCreate={handleCreate}
            onCancel={() => {
              setCreating(false);
              setNewName("");
            }}
          />
          <DatasetList
            datasets={datasets}
            selected={selected}
            onSelect={setSelected}
            onDelete={handleDelete}
            isDev={isDev}
          />
        </div>
      </div>

      {/* Center: selected dataset detail */}
      <div className="flex flex-col min-w-0" style={{ flex: previewItem ? "0 0 50%" : "1 1 100%" }}>
        {selectedDataset ? (
          <>
            <DatasetDetailHeader
              dataset={selectedDataset}
              onGenerate={handleGenerateClick}
              generating={isGeneratingThis}
              isDev={isDev}
            />
            <DatasetItemList
              dataset={selectedDataset}
              onRemove={handleRemoveItem}
              isDev={isDev}
              onSelectApp={onSelectApp}
              onPreview={handlePreview}
              previewItem={previewItem}
              onNavigateItem={handleNavigateItem}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            データセットを選択してください
          </div>
        )}
      </div>

      {/* Right: preview pane (desktop only) */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            key="preview"
            className="flex flex-col min-w-0 border-l border-gray-700/50 bg-gray-900"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
              <TypeBadge type={previewItem.type} />
              <span className="flex-1 text-xs font-medium text-gray-300 py-2.5 truncate">
                {previewItem.title ?? previewItem.appName}
              </span>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                onClick={closePreview}
                title="閉じる"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto dark-scrollbar p-6 pb-16 bg-gray-900">
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

      <MessageToast message={generatingMessage ?? message} />
    </motion.div>
  );
}

function CreateForm({
  show,
  name,
  onNameChange,
  onCreate,
  onCancel,
}: {
  show: boolean;
  name: string;
  onNameChange: (v: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  if (!show) return null;
  return (
    <motion.div
      className="flex items-center gap-2 mb-3 p-2 rounded-xl border border-gray-700/50 bg-gray-800/60"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <input
        type="text"
        className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-gray-900 border border-gray-600 rounded-lg text-gray-300 outline-none focus:border-indigo-500"
        placeholder="データセット名（英数字）"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreate();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        type="button"
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shrink-0"
        onClick={onCreate}
      >
        作成
      </button>
      <button
        type="button"
        className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors shrink-0"
        onClick={onCancel}
      >
        取消
      </button>
    </motion.div>
  );
}

function DatasetList({
  datasets,
  selected,
  onSelect,
  onDelete,
  isDev,
}: {
  datasets: Dataset[];
  selected: string | null;
  onSelect: (name: string) => void;
  onDelete: (name: string) => void;
  isDev: boolean;
}) {
  if (datasets.length === 0) {
    return (
      <EmptyState
        icon={
          <svg
            aria-hidden="true"
            className="size-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        }
        message="データセットがありません"
        submessage="アプリ要件のOverviewやFeatureを組み合わせて保存できます"
      />
    );
  }

  return (
    <div className="space-y-1">
      {datasets.map((ds) => (
        <button
          type="button"
          key={ds.name}
          className={`
            group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
            ${selected === ds.name ? "bg-indigo-500/15 text-indigo-400" : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}
          `}
          onClick={() => onSelect(ds.name)}
        >
          <svg
            aria-hidden="true"
            className={`size-4 shrink-0 ${selected === ds.name ? "text-indigo-400" : "text-gray-600"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium truncate">{ds.name}</p>
            <p className="text-[11px] text-gray-600">{ds.items.length} items</p>
          </div>
          {isDev && (
            <button
              type="button"
              className="p-1 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`データセット「${ds.name}」を削除しますか？`)) onDelete(ds.name);
              }}
              title="削除"
            >
              <TrashIcon />
            </button>
          )}
        </button>
      ))}
    </div>
  );
}

function DatasetDetailHeader({
  dataset,
  onBack,
  onGenerate,
  generating,
  isDev,
  isMobile,
}: {
  dataset: Dataset;
  onBack?: () => void;
  onGenerate: () => void;
  generating: boolean;
  isDev: boolean;
  isMobile?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
      {isMobile && onBack && <BackButton onClick={onBack} />}
      <span className="px-3 py-2.5 text-xs font-medium text-indigo-400 truncate">
        {dataset.name}
      </span>
      <span className="text-[11px] text-gray-600">{dataset.items.length} items</span>
      <div className="flex-1" />
      {isDev && (
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 my-1 text-xs font-medium rounded-lg transition-colors ${
            dataset.items.length > 0 && !generating
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-gray-800 text-gray-600 cursor-not-allowed"
          }`}
          onClick={onGenerate}
          disabled={dataset.items.length === 0 || generating}
        >
          {generating ? (
            <>
              <motion.div
                className="size-3 rounded-full border border-white/30 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              />
              生成中...
            </>
          ) : (
            <>
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              生成
            </>
          )}
        </button>
      )}
    </div>
  );
}

function DatasetItemList({
  dataset,
  onRemove,
  isDev,
  onSelectApp,
  onPreview,
  previewItem,
  onNavigateItem,
}: {
  dataset: Dataset;
  onRemove: (item: DatasetItem) => void;
  isDev: boolean;
  onSelectApp?: (appName: string) => void;
  onPreview: (item: DatasetItem) => void;
  previewItem: DatasetItem | null;
  onNavigateItem: (item: DatasetItem) => void;
}) {
  const [generatedApps, setGeneratedApps] = useState<string[]>([]);

  useEffect(() => {
    fetchGeneratedAppsFromDataset(dataset.name).then(setGeneratedApps);
  }, [dataset.name]);

  if (dataset.items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-500 text-sm">アイテムがありません</p>
          <p className="text-gray-600 text-xs mt-1">
            アプリ要件画面から Overview や Feature を追加してください
          </p>
        </div>
      </div>
    );
  }

  const grouped = new Map<string, DatasetItem[]>();
  for (const item of dataset.items) {
    const list = grouped.get(item.appName) ?? [];
    list.push(item);
    grouped.set(item.appName, list);
  }

  return (
    <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {Array.from(grouped.entries()).map(([appName, items]) => (
          <div key={appName}>
            {onSelectApp ? (
              <button
                type="button"
                className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 hover:text-indigo-400 mb-2 px-1 transition-colors"
                onClick={() => onSelectApp(appName)}
              >
                {appName}
              </button>
            ) : (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-2 px-1">
                {appName}
              </p>
            )}
            <div className="space-y-1">
              {items.map((item) => {
                const key = itemKey(item);
                const isActive = previewItem != null && itemKey(previewItem) === key;
                return (
                  <motion.div
                    key={key}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                      isActive
                        ? "bg-indigo-500/10 border-indigo-500/30"
                        : "border-gray-700/50 bg-gray-800/60"
                    }`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TypeBadge type={item.type} className="rounded-lg text-[11px] px-2 py-1" />
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        className="text-xs font-medium text-gray-200 hover:text-indigo-300 transition-colors truncate max-w-full text-left"
                        onClick={() => onNavigateItem(item)}
                      >
                        {item.title ?? item.featureId ?? "Overview"}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Preview button */}
                      <button
                        type="button"
                        className={`p-1 rounded-md transition-colors ${
                          isActive
                            ? "text-indigo-400 bg-indigo-400/10"
                            : "text-gray-600 hover:text-indigo-400 hover:bg-indigo-400/10"
                        }`}
                        onClick={() => onPreview(item)}
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
                      {isDev && (
                        <button
                          type="button"
                          className="p-1 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          onClick={() => {
                            if (window.confirm("このアイテムをデータセットから削除しますか？"))
                              onRemove(item);
                          }}
                          title="削除"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 生成されたアプリ */}
        {generatedApps.length > 0 && (
          <div className="pt-2 border-t border-gray-700/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">
              生成されたアプリ
            </p>
            <div className="space-y-1">
              {generatedApps.map((appName) => (
                <motion.div
                  key={appName}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-700/50 bg-gray-800/60"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="inline-flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold px-2 py-1 bg-emerald-900/40 text-emerald-400">
                    APP
                  </span>
                  <div className="flex-1 min-w-0">
                    {onSelectApp ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-gray-200 hover:text-indigo-300 hover:underline transition-colors truncate"
                        onClick={() => onSelectApp(appName)}
                      >
                        {appName}
                      </button>
                    ) : (
                      <p className="text-xs font-medium text-gray-200 truncate">{appName}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
