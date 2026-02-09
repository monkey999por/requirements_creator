import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  type Feature,
  fetchFeatureDetail,
  fetchFeatures,
  fetchMode,
  fetchOverview,
  fetchSourceInfo,
} from "../api";
import { DatasetAddButton } from "./DatasetAddButton";
import { MarkdownPane } from "./MarkdownPane";
import { MemoTab } from "./MemoTab";

type LeftTab = "overview" | "source-info" | "memo";
type MobileTab = "overview" | "source-info" | "features" | "memo";

const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function AppView({ appName, isMobile }: { appName: string; isMobile: boolean }) {
  const [overview, setOverview] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [featureContent, setFeatureContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("overview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    fetchMode().then((r) => setIsDev(r.isDev));
  }, []);

  useEffect(() => {
    setSelectedFeature(null);
    setFeatureContent("");
    setLeftTab("overview");
    setMobileTab("overview");
    setLoading(true);
    Promise.all([
      fetchOverview(appName).then((r) => setOverview(r.content)),
      fetchFeatures(appName).then(setFeatures),
      fetchSourceInfo(appName)
        .then((r) => setSourceInfo(r.content))
        .catch(() => setSourceInfo("")),
    ]).finally(() => setLoading(false));
  }, [appName]);

  useEffect(() => {
    if (selectedFeature) {
      setFeatureContent("");
      fetchFeatureDetail(appName, selectedFeature).then((r) => setFeatureContent(r.content));
    }
  }, [appName, selectedFeature]);

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
                setSelectedFeature(null);
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
          <div className="flex-1 overflow-y-auto dark-scrollbar p-4 bg-gray-900">
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
            active={mobileTab === "features"}
            onClick={() => setMobileTab("features")}
            label="Features"
          />
          <TabButton
            active={mobileTab === "memo"}
            onClick={() => setMobileTab("memo")}
            label="Memo"
          />
          {mobileTab === "overview" && (
            <div className="ml-auto">
              <DatasetAddButton
                item={{ appName, type: "overview", title: appName }}
                isDev={isDev}
              />
            </div>
          )}
        </div>
        {/* Content */}
        {mobileTab === "memo" ? (
          <div className="flex-1 overflow-hidden bg-gray-900">
            <MemoTab appName={appName} isMobile={isMobile} isDev={isDev} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto dark-scrollbar p-4 bg-gray-900">
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
                      onClick={() => setSelectedFeature(f.id)}
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
              ) : (
                <motion.div
                  key={mobileTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MarkdownPane content={mobileTab === "overview" ? overview : sourceInfo} />
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
            setSelectedFeature(null);
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
                setSelectedFeature(null);
                setFeatureContent("");
              }}
              label="Overview"
            />
            <TabButton
              active={leftTab === "source-info"}
              onClick={() => {
                setLeftTab("source-info");
                setSelectedFeature(null);
                setFeatureContent("");
              }}
              label="Source Info"
            />
            <TabButton
              active={leftTab === "memo"}
              onClick={() => {
                setLeftTab("memo");
                setSelectedFeature(null);
                setFeatureContent("");
              }}
              label="Memo"
            />
            {leftTab === "overview" && (
              <div className="ml-auto">
                <DatasetAddButton
                  item={{ appName, type: "overview", title: appName }}
                  isDev={isDev}
                />
              </div>
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
                <motion.div
                  key={leftTab}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                >
                  <MarkdownPane content={leftTab === "overview" ? overview : sourceInfo} />
                </motion.div>
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
                setSelectedFeature(null);
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
                    setSelectedFeature(f.id);
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
                  setSelectedFeature(null);
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
