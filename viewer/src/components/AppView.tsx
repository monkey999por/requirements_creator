import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  type Feature,
  fetchFeatureDetail,
  fetchFeatures,
  fetchOverview,
  fetchSourceInfo,
} from "../api";
import { MarkdownPane } from "./MarkdownPane";

type LeftTab = "overview" | "source-info";

const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function AppView({ appName }: { appName: string }) {
  const [overview, setOverview] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [featureContent, setFeatureContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedFeature(null);
    setFeatureContent("");
    setLeftTab("overview");
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
            className="size-8 rounded-full border-2 border-indigo-200 border-t-indigo-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
          <p className="text-xs text-gray-400">読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 左ペイン: Overview / Source Info */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 bg-white border-b border-gray-100 shrink-0">
          <TabButton
            active={leftTab === "overview"}
            onClick={() => setLeftTab("overview")}
            label="Overview"
          />
          <TabButton
            active={leftTab === "source-info"}
            onClick={() => setLeftTab("source-info")}
            label="Source Info"
          />
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
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
      </div>

      {/* 右ペイン: Features */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 bg-white border-b border-gray-100 shrink-0">
          <TabButton
            active={!selectedFeature}
            onClick={() => {
              setSelectedFeature(null);
              setFeatureContent("");
            }}
            label="Features"
          />
          {selectedFeature && (
            <motion.span
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-indigo-600 border-b-2 border-indigo-500"
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
          )}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
          <AnimatePresence mode="wait">
            {selectedFeature ? (
              <motion.div
                key={selectedFeature}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <motion.button
                  type="button"
                  onClick={() => {
                    setSelectedFeature(null);
                    setFeatureContent("");
                  }}
                  className="group inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full"
                  whileHover={{ backgroundColor: "#eef2ff", color: "#4f46e5" }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.svg
                    aria-hidden="true"
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    whileHover={{ x: -2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </motion.svg>
                  一覧に戻る
                </motion.button>
                <MarkdownPane content={featureContent} />
              </motion.div>
            ) : (
              <motion.div
                key="feature-list"
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
                      boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)",
                      borderColor: "#c7d2fe",
                    }}
                    whileTap={{ scale: 0.995 }}
                    className="group w-full flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-white text-left"
                    onClick={() => setSelectedFeature(f.id)}
                  >
                    {/* Number Badge */}
                    <motion.span
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 text-xs font-bold"
                      whileHover={{
                        background: "linear-gradient(to bottom right, #e0e7ff, #ede9fe)",
                        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.15)",
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {f.id.split("_")[0]}
                    </motion.span>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">
                        {f.title}
                      </h3>
                      {f.summary && (
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {f.summary}
                        </p>
                      )}
                    </div>
                    {/* Arrow */}
                    <motion.svg
                      aria-hidden="true"
                      className="size-4 shrink-0 mt-0.5 text-gray-300"
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
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
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
        relative px-3 py-2.5 text-xs font-medium
        ${active ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"}
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
