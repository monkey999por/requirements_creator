import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AppInfo,
  fetchApps,
  fetchGeneratedAppsFromDataset,
  fetchMode,
  fetchOverview,
  type GrepSearchResult,
  generateFromDataset,
  searchByTag,
  searchGrep,
  type TagSearchResult,
} from "./api";
import { AppView } from "./components/AppView";
import { DatasetManager } from "./components/DatasetManager";
import { SearchView } from "./components/SearchView";
import { Sidebar } from "./components/Sidebar";
import { ToastProvider } from "./components/Toast";
import { useIsMobile } from "./hooks/useIsMobile";

type ViewMode = "apps" | "datasets";

export function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("apps");
  const [isDev, setIsDev] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Generation state (lifted from DatasetManager to survive view changes)
  const [generating, setGenerating] = useState(false);
  const [generatingDataset, setGeneratingDataset] = useState<string | null>(null);
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"grep" | "tag">("grep");
  const [grepResults, setGrepResults] = useState<GrepSearchResult[]>([]);
  const [tagResults, setTagResults] = useState<TagSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchApps().then(setApps);
    fetchMode().then((r) => setIsDev(r.isDev));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // URL から datasets ビュー + 選択データセットを復元
    if (params.get("view") === "datasets") {
      setViewMode("datasets");
      const dsParam = params.get("dataset");
      if (dsParam) setSelectedDataset(dsParam);
    }
    if (apps.length > 0 && !selectedApp) {
      const appParam = params.get("app");
      const names = apps.map((a) => a.name);
      setSelectedApp(appParam && names.includes(appParam) ? appParam : apps[0].name);
    }
  }, [apps, selectedApp]);

  useEffect(() => {
    if (selectedApp && viewMode === "apps") {
      const url = new URL(window.location.href);
      url.searchParams.set("app", selectedApp);
      url.searchParams.delete("view");
      url.searchParams.delete("dataset");
      window.history.replaceState({}, "", url.toString());
    }
    if (viewMode === "datasets") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "datasets");
      url.searchParams.delete("app");
      if (selectedDataset) {
        url.searchParams.set("dataset", selectedDataset);
      } else {
        url.searchParams.delete("dataset");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedApp, viewMode, selectedDataset]);

  const handleSelectApp = (app: string) => {
    setSelectedApp(app);
    setViewMode("apps");
    setSearchActive(false);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleSelectDatasets = () => {
    setViewMode("datasets");
    setSearchActive(false);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleNavigateToDataset = (datasetName: string) => {
    setSelectedDataset(datasetName);
    setViewMode("datasets");
    setSearchActive(false);
  };

  const handleNavigateToApp = (appName: string) => {
    handleSelectApp(appName);
  };

  // --- Dataset generation with polling ---
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleDatasetGenerate = useCallback(
    async (datasetName: string) => {
      setGenerating(true);
      setGeneratingDataset(datasetName);

      const currentApps = await fetchGeneratedAppsFromDataset(datasetName);
      const result = await generateFromDataset(datasetName);

      if (!result.success) {
        setGeneratingMessage(result.message ?? "エラー");
        setGenerating(false);
        setGeneratingDataset(null);
        setTimeout(() => setGeneratingMessage(null), 5000);
        return;
      }

      setGeneratingMessage("生成中... overview.md の作成を待機しています");

      pollingRef.current = setInterval(async () => {
        try {
          const latestApps = await fetchGeneratedAppsFromDataset(datasetName);
          const newApps = latestApps.filter((a) => !currentApps.includes(a));
          if (newApps.length > 0) {
            const overview = await fetchOverview(newApps[0]);
            if (overview.content) {
              stopPolling();
              setGenerating(false);
              setGeneratingDataset(null);
              setGeneratingMessage(`生成完了: ${newApps[0]}`);
              fetchApps().then(setApps);
              setTimeout(() => setGeneratingMessage(null), 5000);
            }
          }
        } catch {
          // overview未作成 or ポーリングエラー、継続
        }
      }, 3000);

      timeoutRef.current = setTimeout(
        () => {
          stopPolling();
          setGenerating(false);
          setGeneratingDataset(null);
          setGeneratingMessage("タイムアウトしました。アプリ一覧を確認してください。");
          fetchApps().then(setApps);
          setTimeout(() => setGeneratingMessage(null), 5000);
        },
        5 * 60 * 1000,
      );
    },
    [stopPolling],
  );

  const handleSearch = useCallback(
    async (query: string, type: "grep" | "tag") => {
      setSearchQuery(query);
      setSearchType(type);
      setSearchActive(true);
      setViewMode("apps");
      setSearching(true);
      if (isMobile) setMobileSidebarOpen(false);
      try {
        if (type === "grep") {
          const results = await searchGrep(query);
          setGrepResults(results);
          setTagResults([]);
        } else {
          const results = await searchByTag(query);
          setTagResults(results);
          setGrepResults([]);
        }
      } finally {
        setSearching(false);
      }
    },
    [isMobile],
  );

  const handleClearSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery("");
    setGrepResults([]);
    setTagResults([]);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        {/* Mobile header */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-30 h-12 flex items-center gap-3 px-4 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-200 truncate">
              {viewMode === "datasets" ? "データセット" : (selectedApp ?? "Requirements Viewer")}
            </span>
          </div>
        )}

        <Sidebar
          apps={apps}
          selected={viewMode === "apps" ? selectedApp : null}
          onSelect={handleSelectApp}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          isMobile={isMobile}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          viewMode={viewMode}
          onSelectDatasets={handleSelectDatasets}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
          isSearchActive={searchActive}
        />

        <main
          className={`flex-1 overflow-hidden ${
            isMobile
              ? "pt-12 bg-gray-900"
              : "mb-3 mr-3 rounded-2xl bg-gray-900 shadow-2xl shadow-black/50 ring-1 ring-gray-800"
          }`}
        >
          {viewMode === "datasets" ? (
            <DatasetManager
              isMobile={isMobile}
              isDev={isDev}
              onSelectApp={handleNavigateToApp}
              initialSelected={selectedDataset}
              generating={generating}
              generatingDataset={generatingDataset}
              generatingMessage={generatingMessage}
              onGenerate={handleDatasetGenerate}
            />
          ) : searchActive ? (
            searching ? (
              <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                検索中...
              </div>
            ) : (
              <SearchView
                query={searchQuery}
                searchType={searchType}
                grepResults={grepResults}
                tagResults={tagResults}
                onSelectApp={handleSelectApp}
                isMobile={isMobile}
              />
            )
          ) : selectedApp ? (
            <AppView
              key={selectedApp}
              appName={selectedApp}
              isMobile={isMobile}
              onNavigateToDataset={handleNavigateToDataset}
              onNavigateToApp={handleNavigateToApp}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
              アプリを選択してください
            </div>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
