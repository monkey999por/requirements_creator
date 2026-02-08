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
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="size-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
          <p className="text-xs text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-fade-in">
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
          <div className="animate-scale-in">
            <MarkdownPane content={leftTab === "overview" ? overview : sourceInfo} />
          </div>
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
            <span className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-indigo-600 border-b-2 border-indigo-500 animate-slide-right">
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
            </span>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
          {selectedFeature ? (
            <div className="animate-scale-in">
              <button
                type="button"
                onClick={() => {
                  setSelectedFeature(null);
                  setFeatureContent("");
                }}
                className="group inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
              >
                <svg
                  aria-hidden="true"
                  className="size-3 transition-transform duration-200 group-hover:-translate-x-0.5"
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
                一覧に戻る
              </button>
              <MarkdownPane content={featureContent} />
            </div>
          ) : (
            <div className="space-y-2">
              {features.map((f, i) => (
                <button
                  type="button"
                  key={f.id}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="
                    group w-full flex items-start gap-4 p-4 rounded-xl border border-gray-100
                    bg-white text-left transition-all duration-300
                    hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5
                    animate-slide-up opacity-0
                  "
                  onClick={() => setSelectedFeature(f.id)}
                >
                  {/* Number Badge */}
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 text-xs font-bold transition-all duration-300 group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:shadow-md group-hover:shadow-indigo-500/10">
                    {f.id.split("_")[0]}
                  </span>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors duration-200">
                      {f.title}
                    </h3>
                    {f.summary && (
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {f.summary}
                      </p>
                    )}
                  </div>
                  {/* Arrow */}
                  <svg
                    aria-hidden="true"
                    className="size-4 shrink-0 mt-0.5 text-gray-300 transition-all duration-200 group-hover:text-indigo-400 group-hover:translate-x-0.5"
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
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
        relative px-3 py-2.5 text-xs font-medium transition-colors duration-200
        ${active ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"}
      `}
      onClick={onClick}
    >
      {label}
      {/* Animated underline */}
      <span
        className={`
          absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-indigo-500
          transition-all duration-300 ease-out
          ${active ? "w-full" : "w-0"}
        `}
      />
    </button>
  );
}
