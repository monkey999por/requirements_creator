import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  commitAndPush,
  type DiagramFile,
  type Feature,
  fetchDiagrams,
  fetchFeatureDetail,
  fetchFeatures,
  fetchMode,
  fetchOverview,
  fetchSourceInfo,
  type SourceInfo,
} from "../api";
import { DatasetAddButton } from "./DatasetAddButton";
import { MarkdownPane } from "./MarkdownPane";
import { MemoTab } from "./MemoTab";
import { useToast } from "./Toast";

type LeftTab = "overview" | "source-info" | "diagrams" | "memo";
type MobileTab = "overview" | "source-info" | "diagrams" | "features" | "memo";

const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function AppView({
  appName,
  isMobile,
  onNavigateToDataset,
  onNavigateToApp,
  selectedFeature,
  onSelectFeature,
}: {
  appName: string;
  isMobile: boolean;
  onNavigateToDataset?: (datasetName: string) => void;
  onNavigateToApp?: (appName: string) => void;
  selectedFeature: string | null;
  onSelectFeature: (feature: string | null) => void;
}) {
  const [overview, setOverview] = useState("");
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramFile[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featureContent, setFeatureContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("overview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [pushing, setPushing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchMode().then((r) => setIsDev(r.isDev));
  }, []);

  useEffect(() => {
    setFeatureContent("");
    setLeftTab("overview");
    setMobileTab("overview");
    setLoading(true);
    Promise.all([
      fetchOverview(appName).then((r) => setOverview(r.content)),
      fetchFeatures(appName).then(setFeatures),
      fetchSourceInfo(appName)
        .then((r) => setSourceInfo(r))
        .catch(() => setSourceInfo(null)),
      fetchDiagrams(appName)
        .then(setDiagrams)
        .catch(() => setDiagrams([])),
    ]).finally(() => setLoading(false));
  }, [appName]);

  useEffect(() => {
    if (selectedFeature) {
      setFeatureContent("");
      fetchFeatureDetail(appName, selectedFeature).then((r) => setFeatureContent(r.content));
    }
  }, [appName, selectedFeature]);

  const handleCommitPush = useCallback(async () => {
    if (pushing) return;
    setPushing(true);
    try {
      const result = await commitAndPush();
      showToast({
        title: result.success ? "Commit & Push 完了" : "Commit & Push 失敗",
        output: result.output,
        success: result.success,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showToast({
        title: "Commit & Push エラー",
        output: message,
        success: false,
      });
    } finally {
      setPushing(false);
    }
  }, [pushing, showToast]);

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
    // Feature detail view
    if (selectedFeature) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Header with back button */}
          <div className="flex items-center gap-2 px-4 bg-gray-900 border-b border-gray-800 shrink-0">
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
              onClick={() => {
                onSelectFeature(null);
                setFeatureContent("");
              }}
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
            <span className="text-xs font-medium text-indigo-400 py-2.5 truncate">
              {features.find((f) => f.id === selectedFeature)?.title ?? selectedFeature}
            </span>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-8 bg-gray-900">
            <MarkdownPane content={featureContent} />
          </div>
        </motion.div>
      );
    }

    // Tab-based view
    return (
      <motion.div
        className="flex flex-col h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 bg-gray-900 border-b border-gray-800 shrink-0 overflow-x-auto">
          <TabButton
            active={mobileTab === "overview"}
            onClick={() => setMobileTab("overview")}
            label="Overview"
          />
          <TabButton
            active={mobileTab === "source-info"}
            onClick={() => setMobileTab("source-info")}
            label="Source Info"
          />
          <TabButton
            active={mobileTab === "diagrams"}
            onClick={() => setMobileTab("diagrams")}
            label="Diagrams"
          />
          <TabButton
            active={mobileTab === "features"}
            onClick={() => setMobileTab("features")}
            label="Features"
          />
          <TabButton
            active={mobileTab === "memo"}
            onClick={() => setMobileTab("memo")}
            label="Memo"
          />
          {isDev && (
            <>
              {mobileTab === "overview" && (
                <DatasetAddButton
                  item={{ appName, type: "overview", title: appName }}
                  isDev={isDev}
                />
              )}
              <div className="flex-1" />
              <CommitPushButton pushing={pushing} onClick={handleCommitPush} />
            </>
          )}
        </div>
        {/* Content */}
        {mobileTab === "memo" ? (
          <div className="flex-1 overflow-hidden bg-gray-900">
            <MemoTab appName={appName} isMobile={isMobile} isDev={isDev} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-8 bg-gray-900">
            <AnimatePresence mode="wait">
              {mobileTab === "features" ? (
                <motion.div
                  key="features"
                  className="space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {features.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      className="w-full flex items-start gap-3 p-4 rounded-xl border border-gray-700/50 bg-gray-800/60 text-left active:bg-gray-800 transition-colors"
                      onClick={() => onSelectFeature(f.id)}
                    >
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-gradient-to-br from-indigo-900/40 to-purple-900/40 text-indigo-400">
                        {f.id.split("_")[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-200">{f.title}</h3>
                        {f.summary && (
                          <p className="mt-1 text-xs text-gray-400 leading-relaxed line-clamp-2">
                            {f.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <DatasetAddButton
                          item={{
                            appName,
                            type: "feature",
                            featureId: f.id,
                            title: f.title,
                          }}
                          isDev={isDev}
                        />
                        <svg
                          className="size-4 text-gray-600"
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
                      </div>
                    </button>
                  ))}
                </motion.div>
              ) : mobileTab === "source-info" ? (
                <motion.div
                  key="source-info"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <SourceInfoView
                    info={sourceInfo}
                    onNavigateToDataset={onNavigateToDataset}
                    onNavigateToApp={onNavigateToApp}
                  />
                </motion.div>
              ) : mobileTab === "diagrams" ? (
                <motion.div
                  key="diagrams"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {diagrams.length > 0 ? (
                    <div className="space-y-8">
                      {diagrams.map((d) => (
                        <section key={d.id}>
                          <MarkdownPane content={d.content} />
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">図解データがありません</p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={mobileTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MarkdownPane content={overview} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <motion.div
      className="flex h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 左側: Overview/SourceInfo + Features一覧 */}
      <motion.div
        className="flex min-w-0 border-r border-gray-700/50"
        animate={{ flex: selectedFeature ? "0 0 50%" : "1 1 100%" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={() => {
          if (selectedFeature) {
            onSelectFeature(null);
            setFeatureContent("");
          }
        }}
      >
        {/* Overview / Source Info ペイン */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700/50">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
            <TabButton
              active={leftTab === "overview"}
              onClick={() => {
                setLeftTab("overview");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Overview"
            />
            <TabButton
              active={leftTab === "source-info"}
              onClick={() => {
                setLeftTab("source-info");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Source Info"
            />
            <TabButton
              active={leftTab === "diagrams"}
              onClick={() => {
                setLeftTab("diagrams");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Diagrams"
            />
            <TabButton
              active={leftTab === "memo"}
              onClick={() => {
                setLeftTab("memo");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Memo"
            />
            {isDev && (
              <>
                {leftTab === "overview" && (
                  <DatasetAddButton
                    item={{ appName, type: "overview", title: appName }}
                    isDev={isDev}
                  />
                )}
                <div className="flex-1" />
                <CommitPushButton pushing={pushing} onClick={handleCommitPush} />
              </>
            )}
          </div>
          {/* Content */}
          {leftTab === "memo" ? (
            <div className="flex-1 overflow-hidden bg-gray-900">
              <MemoTab appName={appName} isMobile={isMobile} isDev={isDev} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
              <AnimatePresence mode="wait">
                {leftTab === "source-info" ? (
                  <motion.div
                    key="source-info"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                  >
                    <SourceInfoView
                      info={sourceInfo}
                      onNavigateToDataset={onNavigateToDataset}
                      onNavigateToApp={onNavigateToApp}
                    />
                  </motion.div>
                ) : leftTab === "diagrams" ? (
                  <motion.div
                    key="diagrams"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                  >
                    {diagrams.length > 0 ? (
                      <div className="space-y-8">
                        {diagrams.map((d) => (
                          <section key={d.id}>
                            <MarkdownPane content={d.content} />
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">図解データがありません</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                  >
                    <MarkdownPane content={overview} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Features一覧ペイン */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
            <TabButton
              active
              onClick={() => {
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Features"
            />
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
            <motion.div
              className="space-y-2"
              variants={cardContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {features.map((f) => (
                <motion.button
                  type="button"
                  key={f.id}
                  variants={cardVariants}
                  whileHover={{
                    y: -2,
                    boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.15)",
                    borderColor: "#4338ca",
                  }}
                  whileTap={{ scale: 0.995 }}
                  className={`
                    group w-full flex items-start gap-4 p-4 rounded-xl border bg-gray-800/60 text-left
                    ${selectedFeature === f.id ? "border-indigo-500/50 bg-indigo-950/30 shadow-md shadow-indigo-500/10" : "border-gray-700/50"}
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedFeature === f.id) return;
                    onSelectFeature(f.id);
                  }}
                >
                  {/* Number Badge */}
                  <motion.span
                    className={`
                      inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold
                      ${selectedFeature === f.id ? "bg-gradient-to-br from-indigo-600/30 to-purple-600/30 text-indigo-300" : "bg-gradient-to-br from-indigo-900/40 to-purple-900/40 text-indigo-400"}
                    `}
                    whileHover={{
                      background: "linear-gradient(to bottom right, #312e81, #4c1d95)",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {f.id.split("_")[0]}
                  </motion.span>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-sm font-semibold group-hover:text-indigo-300 ${selectedFeature === f.id ? "text-indigo-300" : "text-gray-200"}`}
                    >
                      {f.title}
                    </h3>
                    {f.summary && (
                      <p className="mt-1 text-xs text-gray-400 leading-relaxed line-clamp-2">
                        {f.summary}
                      </p>
                    )}
                  </div>
                  {/* Dataset add + Arrow */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <DatasetAddButton
                      item={{
                        appName,
                        type: "feature",
                        featureId: f.id,
                        title: f.title,
                      }}
                      isDev={isDev}
                    />
                    <motion.svg
                      aria-hidden="true"
                      className={`size-4 ${selectedFeature === f.id ? "text-indigo-400" : "text-gray-600"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      whileHover={{ x: 2, color: "#818cf8" }}
                      transition={{ duration: 0.2 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </motion.svg>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* 右側: Feature詳細（選択時にスライドイン） */}
      <AnimatePresence>
        {selectedFeature && (
          <motion.div
            key="feature-detail"
            className="flex-1 flex flex-col min-w-0 border-l border-gray-700/50"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
              <motion.span
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-indigo-400 border-b-2 border-indigo-500"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                <svg
                  aria-hidden="true"
                  className="size-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {features.find((f) => f.id === selectedFeature)?.title ?? selectedFeature}
              </motion.span>
              <motion.button
                type="button"
                className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                onClick={() => {
                  onSelectFeature(null);
                  setFeatureContent("");
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="閉じる"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedFeature}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <MarkdownPane content={featureContent} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SourceInfoView({
  info,
  onNavigateToDataset,
  onNavigateToApp,
}: {
  info: SourceInfo | null;
  onNavigateToDataset?: (datasetName: string) => void;
  onNavigateToApp?: (appName: string) => void;
}) {
  if (!info) {
    return <p className="text-sm text-gray-500">ソース情報がありません</p>;
  }

  return (
    <div className="space-y-6">
      {/* Dataset */}
      {info.dataset && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            データセット
          </h3>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30 space-y-3">
            {info.dataset.name && (
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">名前: </span>
                {onNavigateToDataset ? (
                  <button
                    type="button"
                    className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    onClick={() => {
                      if (info.dataset?.name) onNavigateToDataset(info.dataset.name);
                    }}
                  >
                    {info.dataset.name}
                  </button>
                ) : (
                  <span className="text-indigo-400">{info.dataset.name}</span>
                )}
              </p>
            )}
            {info.dataset.sourceApps && info.dataset.sourceApps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  参照元
                </p>
                <div className="space-y-1">
                  {info.dataset.sourceApps.map((sa) => {
                    const key = `${sa.appName}-${sa.type}-${sa.featureId ?? ""}`;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-900/50"
                      >
                        <span
                          className={`inline-flex shrink-0 items-center justify-center rounded text-[9px] font-bold px-1.5 py-0.5 ${
                            sa.type === "overview"
                              ? "bg-blue-900/40 text-blue-400"
                              : "bg-purple-900/40 text-purple-400"
                          }`}
                        >
                          {sa.type === "overview" ? "OVR" : "FTR"}
                        </span>
                        {onNavigateToApp ? (
                          <button
                            type="button"
                            className="text-xs text-gray-300 hover:text-indigo-300 hover:underline transition-colors truncate"
                            onClick={() => onNavigateToApp(sa.appName)}
                          >
                            {sa.appName}
                            {sa.title ? ` / ${sa.title}` : ""}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 truncate">
                            {sa.appName}
                            {sa.title ? ` / ${sa.title}` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Source */}
      {info.source && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            データソース
          </h3>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30 space-y-1">
            {info.source.directory && (
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">ディレクトリ: </span>
                <code className="text-indigo-400">{info.source.directory}</code>
              </p>
            )}
            {info.source.collected_at && (
              <p className="text-xs text-gray-300">
                <span className="text-gray-500">収集日時: </span>
                {info.source.collected_at}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Tags */}
      {info.tags && info.tags.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            タグ
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {info.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Keywords */}
      {info.keywords && info.keywords.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            キーワード
          </h3>
          <div className="space-y-1">
            {info.keywords.map((kw) => (
              <div
                key={kw.word}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/30"
              >
                <span className="text-xs text-gray-200">{kw.word}</span>
                {kw.relevance != null && (
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    {(kw.relevance * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      {info.description && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            生成の経緯
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{info.description}</p>
        </section>
      )}
    </div>
  );
}

function CommitPushButton({ pushing, onClick }: { pushing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`px-3 py-1 my-1 text-xs font-medium rounded-lg transition-colors ${
        pushing
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : "bg-emerald-700 text-white hover:bg-emerald-600"
      }`}
      onClick={onClick}
      disabled={pushing}
    >
      {pushing ? "Push中..." : "Commit & Push"}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`
        relative px-3 py-2.5 text-xs font-medium whitespace-nowrap
        ${active ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}
      `}
      onClick={onClick}
    >
      {label}
      {/* Animated underline */}
      <motion.span
        className="absolute bottom-0 left-0 h-0.5 rounded-full bg-indigo-500"
        initial={false}
        animate={{ width: active ? "100%" : "0%", opacity: active ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </button>
  );
}
