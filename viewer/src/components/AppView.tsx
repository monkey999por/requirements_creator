import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { staggerContainerVariants, staggerItemVariants } from "../animations";
import {
  addFavorite,
  type DiagramFile,
  type FavoriteItem,
  type Feature,
  fetchAppGenerationConfig,
  fetchDiagrams,
  fetchFavorites,
  fetchFeatureDetail,
  fetchFeatures,
  fetchMode,
  fetchOverview,
  fetchSourceInfo,
  removeFavorite,
  type SourceInfo,
} from "../api";
import { type SwipeDirection, useSwipeTab } from "../hooks/useSwipeTab";
import { DatasetAddButton } from "./DatasetAddButton";
import { MarkdownPane } from "./MarkdownPane";
import { MemoTab } from "./MemoTab";
import { LoadingSpinner } from "./shared/LoadingSpinner";

export type AppTab = "overview" | "source-info" | "diagrams" | "features" | "memo";
type LeftTab = "overview" | "source-info" | "diagrams" | "memo";

/** モバイルタブの並び順 */
const MOBILE_TABS: readonly AppTab[] = [
  "overview",
  "source-info",
  "diagrams",
  "features",
  "memo",
] as const;

/** スワイプ方向に応じたスライドアニメーション */
function slideVariants(dir: SwipeDirection) {
  const offset = 60;
  return {
    initial: { opacity: 0, x: dir * offset },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir * -offset },
  };
}

export function AppView({
  appName,
  isMobile,
  onNavigateToDataset,
  onNavigateToApp,
  selectedFeature,
  onSelectFeature,
  selectedTab,
  onSelectTab,
  pinnedTab,
  onPinTab,
}: {
  appName: string;
  isMobile: boolean;
  onNavigateToDataset?: (datasetName: string) => void;
  onNavigateToApp?: (appName: string) => void;
  selectedFeature: string | null;
  onSelectFeature: (feature: string | null) => void;
  selectedTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pinnedTab: AppTab | null;
  onPinTab: (tab: AppTab) => void;
}) {
  const [overview, setOverview] = useState("");
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [configYaml, setConfigYaml] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramFile[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featureContent, setFeatureContent] = useState("");
  const leftTab: LeftTab = selectedTab === "features" ? "overview" : (selectedTab as LeftTab);
  const mobileTab: AppTab = selectedTab;
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  useEffect(() => {
    fetchMode().then((r) => setIsDev(r.isDev));
  }, []);

  useEffect(() => {
    fetchFavorites().then(setFavorites);
  }, []);

  const isFavorited = useCallback(
    (type: FavoriteItem["type"], featureId?: string, diagramId?: string) => {
      return favorites.some(
        (f) =>
          f.appName === appName &&
          f.type === type &&
          f.featureId === featureId &&
          f.diagramId === diagramId,
      );
    },
    [appName, favorites],
  );

  const handleToggleFavorite = useCallback(
    async (type: FavoriteItem["type"], title?: string, featureId?: string, diagramId?: string) => {
      const item: FavoriteItem = { appName, type, featureId, diagramId, title };
      if (isFavorited(type, featureId, diagramId)) {
        await removeFavorite(item);
        setFavorites((prev) =>
          prev.filter(
            (f) =>
              !(
                f.appName === appName &&
                f.type === type &&
                f.featureId === featureId &&
                f.diagramId === diagramId
              ),
          ),
        );
      } else {
        await addFavorite(item);
        setFavorites((prev) => [...prev, item]);
      }
    },
    [appName, isFavorited],
  );

  useEffect(() => {
    setFeatureContent("");
    setLoading(true);
    Promise.all([
      fetchOverview(appName).then((r) => setOverview(r.content)),
      fetchFeatures(appName).then(setFeatures),
      fetchSourceInfo(appName)
        .then((r) => setSourceInfo(r))
        .catch(() => setSourceInfo(null)),
      fetchAppGenerationConfig(appName)
        .then((r) => setConfigYaml(r?.content ?? null))
        .catch(() => setConfigYaml(null)),
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

  if (loading) {
    return <LoadingSpinner />;
  }

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <MobileLayout
        appName={appName}
        isMobile={isMobile}
        selectedFeature={selectedFeature}
        onSelectFeature={onSelectFeature}
        mobileTab={mobileTab}
        onSelectTab={onSelectTab}
        pinnedTab={pinnedTab}
        onPinTab={onPinTab}
        overview={overview}
        sourceInfo={sourceInfo}
        configYaml={configYaml}
        diagrams={diagrams}
        features={features}
        featureContent={featureContent}
        setFeatureContent={setFeatureContent}
        isFavorited={isFavorited}
        handleToggleFavorite={handleToggleFavorite}
        isDev={isDev}
        onNavigateToDataset={onNavigateToDataset}
        onNavigateToApp={onNavigateToApp}
      />
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
                onSelectTab("overview");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Overview"
              pinned={pinnedTab === "overview"}
              onPin={() => onPinTab("overview")}
            />
            <TabButton
              active={leftTab === "source-info"}
              onClick={() => {
                onSelectTab("source-info");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Source Info"
              pinned={pinnedTab === "source-info"}
              onPin={() => onPinTab("source-info")}
            />
            <TabButton
              active={leftTab === "diagrams"}
              onClick={() => {
                onSelectTab("diagrams");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Diagrams"
              pinned={pinnedTab === "diagrams"}
              onPin={() => onPinTab("diagrams")}
            />
            <TabButton
              active={leftTab === "memo"}
              onClick={() => {
                onSelectTab("memo");
                onSelectFeature(null);
                setFeatureContent("");
              }}
              label="Memo"
              pinned={pinnedTab === "memo"}
              onPin={() => onPinTab("memo")}
            />
            {leftTab === "overview" && (
              <FavoriteToggleButton
                active={isFavorited("overview")}
                onClick={() => handleToggleFavorite("overview", appName)}
              />
            )}
            {isDev && leftTab === "overview" && (
              <DatasetAddButton
                item={{ appName, type: "overview", title: appName }}
                isDev={isDev}
              />
            )}
          </div>
          {/* Content */}
          {leftTab === "memo" ? (
            <div className="flex-1 overflow-hidden bg-gray-900">
              <MemoTab appName={appName} isMobile={isMobile} isDev={isDev} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto dark-scrollbar p-6 pb-16 bg-gray-900">
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
                      configYaml={configYaml}
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
                          <section key={d.id} className="relative">
                            <div className="absolute top-0 right-0 z-10">
                              <FavoriteToggleButton
                                active={isFavorited("diagram", undefined, d.id)}
                                onClick={() =>
                                  handleToggleFavorite("diagram", d.title, undefined, d.id)
                                }
                              />
                            </div>
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
          <div className="flex-1 overflow-y-auto dark-scrollbar p-6 pb-16 bg-gray-900">
            <motion.div
              className="space-y-2"
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {features.map((f) => (
                <motion.button
                  type="button"
                  key={f.id}
                  variants={staggerItemVariants}
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
                  {/* Favorite + Dataset add + Arrow */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <FavoriteToggleButton
                      active={isFavorited("feature", f.id)}
                      onClick={() => handleToggleFavorite("feature", f.title, f.id)}
                    />
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
            <div className="flex-1 overflow-y-auto dark-scrollbar p-6 pb-16 bg-gray-900">
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

/* ── MobileLayout (swipe対応) ── */
function MobileLayout({
  appName,
  isMobile,
  selectedFeature,
  onSelectFeature,
  mobileTab,
  onSelectTab,
  pinnedTab,
  onPinTab,
  overview,
  sourceInfo,
  configYaml,
  diagrams,
  features,
  featureContent,
  setFeatureContent,
  isFavorited,
  handleToggleFavorite,
  isDev,
  onNavigateToDataset,
  onNavigateToApp,
}: {
  appName: string;
  isMobile: boolean;
  selectedFeature: string | null;
  onSelectFeature: (feature: string | null) => void;
  mobileTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pinnedTab: AppTab | null;
  onPinTab: (tab: AppTab) => void;
  overview: string;
  sourceInfo: SourceInfo | null;
  configYaml: string | null;
  diagrams: DiagramFile[];
  features: Feature[];
  featureContent: string;
  setFeatureContent: (content: string) => void;
  isFavorited: (type: FavoriteItem["type"], featureId?: string, diagramId?: string) => boolean;
  handleToggleFavorite: (
    type: FavoriteItem["type"],
    title?: string,
    featureId?: string,
    diagramId?: string,
  ) => void;
  isDev: boolean;
  onNavigateToDataset?: (datasetName: string) => void;
  onNavigateToApp?: (appName: string) => void;
}) {
  const { direction, setDirection, swipeHandlers } = useSwipeTab({
    tabs: MOBILE_TABS,
    currentTab: mobileTab,
    onChangeTab: onSelectTab,
    disabled: mobileTab === "memo",
  });

  /** タブボタン押下時: スワイプ方向を計算してからタブ切替 */
  const handleTabClick = useCallback(
    (tab: AppTab) => {
      const fromIdx = MOBILE_TABS.indexOf(mobileTab);
      const toIdx = MOBILE_TABS.indexOf(tab);
      setDirection(toIdx >= fromIdx ? 1 : -1);
      onSelectTab(tab);
    },
    [mobileTab, onSelectTab, setDirection],
  );

  const slide = slideVariants(direction);

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
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
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
          onClick={() => handleTabClick("overview")}
          label="Overview"
          pinned={pinnedTab === "overview"}
          onPin={() => onPinTab("overview")}
        />
        <TabButton
          active={mobileTab === "source-info"}
          onClick={() => handleTabClick("source-info")}
          label="Source Info"
          pinned={pinnedTab === "source-info"}
          onPin={() => onPinTab("source-info")}
        />
        <TabButton
          active={mobileTab === "diagrams"}
          onClick={() => handleTabClick("diagrams")}
          label="Diagrams"
          pinned={pinnedTab === "diagrams"}
          onPin={() => onPinTab("diagrams")}
        />
        <TabButton
          active={mobileTab === "features"}
          onClick={() => handleTabClick("features")}
          label="Features"
        />
        <TabButton
          active={mobileTab === "memo"}
          onClick={() => handleTabClick("memo")}
          label="Memo"
          pinned={pinnedTab === "memo"}
          onPin={() => onPinTab("memo")}
        />
        {mobileTab === "overview" && (
          <FavoriteToggleButton
            active={isFavorited("overview")}
            onClick={() => handleToggleFavorite("overview", appName)}
          />
        )}
        {isDev && mobileTab === "overview" && (
          <DatasetAddButton item={{ appName, type: "overview", title: appName }} isDev={isDev} />
        )}
      </div>
      {/* Content */}
      {mobileTab === "memo" ? (
        <div className="flex-1 overflow-hidden bg-gray-900">
          <MemoTab appName={appName} isMobile={isMobile} isDev={isDev} />
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900"
          {...swipeHandlers}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileTab === "features" ? (
              <motion.div
                key="features"
                className="space-y-2"
                {...slide}
                transition={{ duration: 0.2, ease: "easeOut" }}
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
                      <FavoriteToggleButton
                        active={isFavorited("feature", f.id)}
                        onClick={() => handleToggleFavorite("feature", f.title, f.id)}
                      />
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
                {...slide}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <SourceInfoView
                  info={sourceInfo}
                  configYaml={configYaml}
                  onNavigateToDataset={onNavigateToDataset}
                  onNavigateToApp={onNavigateToApp}
                />
              </motion.div>
            ) : mobileTab === "diagrams" ? (
              <motion.div key="diagrams" {...slide} transition={{ duration: 0.2, ease: "easeOut" }}>
                {diagrams.length > 0 ? (
                  <div className="space-y-8">
                    {diagrams.map((d) => (
                      <section key={d.id} className="relative">
                        <div className="absolute top-0 right-0 z-10">
                          <FavoriteToggleButton
                            active={isFavorited("diagram", undefined, d.id)}
                            onClick={() =>
                              handleToggleFavorite("diagram", d.title, undefined, d.id)
                            }
                          />
                        </div>
                        <MarkdownPane content={d.content} />
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">図解データがありません</p>
                )}
              </motion.div>
            ) : (
              <motion.div key="overview" {...slide} transition={{ duration: 0.2, ease: "easeOut" }}>
                <MarkdownPane content={overview} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function SourceInfoView({
  info,
  configYaml,
  onNavigateToDataset,
  onNavigateToApp,
}: {
  info: SourceInfo | null;
  configYaml?: string | null;
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                          className={`inline-flex shrink-0 items-center justify-center rounded text-[10px] font-bold px-1.5 py-0.5 ${
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
                  <span className="text-[11px] text-gray-500 tabular-nums">
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

      {/* Config */}
      {configYaml && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            生成時の設定
          </h3>
          <pre className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30 text-xs text-gray-300 overflow-x-auto whitespace-pre leading-relaxed">
            {configYaml}
          </pre>
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  pinned,
  onPin,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  pinned?: boolean;
  onPin?: () => void;
}) {
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className={`
          px-3 py-2.5 text-xs font-medium whitespace-nowrap
          ${active ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}
        `}
        onClick={onClick}
      >
        {label}
      </button>
      {onPin != null && (
        <button
          type="button"
          className={`
            -ml-1.5 p-1 rounded transition-colors
            ${pinned ? "text-amber-400 hover:text-amber-300" : "text-gray-600 hover:text-gray-400"}
          `}
          onClick={onPin}
          title={pinned ? "ピン解除" : "タブをピン留め"}
        >
          <svg
            className="size-3"
            viewBox="0 0 24 24"
            fill={pinned ? "currentColor" : "none"}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 4v6l-2 4v2h10v-2l-2-4V4M12 16v5M8 4h8"
            />
          </svg>
        </button>
      )}
      {/* Animated underline */}
      <motion.span
        className="absolute bottom-0 left-0 h-0.5 rounded-full bg-indigo-500"
        initial={false}
        animate={{ width: active ? "100%" : "0%", opacity: active ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

function FavoriteToggleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`p-1 rounded-md transition-colors ${
        active
          ? "text-pink-400 hover:text-pink-300"
          : "text-gray-600 hover:text-pink-400 hover:bg-pink-400/10"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={active ? "お気に入りから削除" : "お気に入りに追加"}
    >
      <svg
        className="size-4"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
