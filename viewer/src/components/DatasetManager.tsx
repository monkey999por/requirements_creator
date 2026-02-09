import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  createDataset,
  type Dataset,
  type DatasetItem,
  deleteDataset,
  fetchDatasets,
  fetchGeneratedAppsFromDataset,
  removeDatasetItem,
} from "../api";

export function DatasetManager({
  isMobile,
  isDev,
  onSelectApp,
  initialSelected,
  generating,
  generatingDataset,
  generatingMessage,
  onGenerate,
}: {
  isMobile: boolean;
  isDev: boolean;
  onSelectApp?: (appName: string) => void;
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
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(result.error ?? "作成エラー");
      setTimeout(() => setMessage(null), 3000);
    }
  }, [newName, reload]);

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
      reload();
    },
    [selected, reload],
  );

  const isGeneratingThis = generating && generatingDataset === selected;

  const handleGenerateClick = useCallback(() => {
    if (selected) onGenerate(selected);
  }, [selected, onGenerate]);

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

  /* Mobile layout */
  if (isMobile) {
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
          {isDev && <CreateButton onClick={() => setCreating(true)} />}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 bg-gray-900">
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
          {isDev && <CreateButton onClick={() => setCreating(true)} />}
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

      {/* Right: selected dataset detail */}
      <div className="flex-1 flex flex-col min-w-0">
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
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            データセットを選択してください
          </div>
        )}
      </div>
      <MessageToast message={generatingMessage ?? message} />
    </motion.div>
  );
}

function CreateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
      onClick={onClick}
      title="新規データセット作成"
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
      <div className="py-12 text-center">
        <div className="size-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
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
        </div>
        <p className="text-gray-600 text-xs">データセットがありません</p>
        <p className="text-gray-700 text-[10px] mt-1">
          アプリ要件のOverviewやFeatureを組み合わせて保存できます
        </p>
      </div>
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
            <p className="text-[13px] font-medium truncate">{ds.name}</p>
            <p className="text-[10px] text-gray-600">{ds.items.length} items</p>
          </div>
          {isDev && (
            <button
              type="button"
              className="p-1 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ds.name);
              }}
              title="削除"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
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
      {isMobile && onBack && (
        <button
          type="button"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          onClick={onBack}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      <span className="px-3 py-2.5 text-xs font-medium text-indigo-400 truncate">
        {dataset.name}
      </span>
      <span className="text-[10px] text-gray-600">{dataset.items.length} items</span>
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
}: {
  dataset: Dataset;
  onRemove: (item: DatasetItem) => void;
  isDev: boolean;
  onSelectApp?: (appName: string) => void;
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
    <div className="flex-1 overflow-y-auto dark-scrollbar p-4 bg-gray-900">
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
                className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 hover:text-indigo-400 mb-2 px-1 transition-colors"
                onClick={() => onSelectApp(appName)}
              >
                {appName}
              </button>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2 px-1">
                {appName}
              </p>
            )}
            <div className="space-y-1">
              {items.map((item) => {
                const key = `${item.appName}-${item.type}-${item.featureId ?? ""}`;
                return (
                  <motion.div
                    key={key}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-700/50 bg-gray-800/60"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span
                      className={`inline-flex shrink-0 items-center justify-center rounded-lg text-[10px] font-bold px-2 py-1 ${
                        item.type === "overview"
                          ? "bg-blue-900/40 text-blue-400"
                          : "bg-purple-900/40 text-purple-400"
                      }`}
                    >
                      {item.type === "overview" ? "OVR" : "FTR"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">
                        {item.title ?? item.featureId ?? "Overview"}
                      </p>
                    </div>
                    {isDev && (
                      <button
                        type="button"
                        className="p-1 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={() => onRemove(item)}
                        title="削除"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 生成されたアプリ */}
        {generatedApps.length > 0 && (
          <div className="pt-2 border-t border-gray-700/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">
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
                  <span className="inline-flex shrink-0 items-center justify-center rounded-lg text-[10px] font-bold px-2 py-1 bg-emerald-900/40 text-emerald-400">
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

function MessageToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-gray-700 text-sm text-gray-200 shadow-xl border border-gray-600"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
