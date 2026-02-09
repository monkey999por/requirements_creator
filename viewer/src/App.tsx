import { useCallback, useEffect, useState } from "react";
import {
  fetchApps,
  type GrepSearchResult,
  searchByTag,
  searchGrep,
  type TagSearchResult,
} from "./api";
import { AppView } from "./components/AppView";
import { SearchView } from "./components/SearchView";
import { Sidebar } from "./components/Sidebar";
import { ToastProvider } from "./components/Toast";
import { useIsMobile } from "./hooks/useIsMobile";

export function App() {
  const [apps, setApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"grep" | "tag">("grep");
  const [grepResults, setGrepResults] = useState<GrepSearchResult[]>([]);
  const [tagResults, setTagResults] = useState<TagSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchApps().then(setApps);
  }, []);

  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get("app");
      setSelectedApp(appParam && apps.includes(appParam) ? appParam : apps[0]);
    }
  }, [apps, selectedApp]);

  useEffect(() => {
    if (selectedApp) {
      const url = new URL(window.location.href);
      url.searchParams.set("app", selectedApp);
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedApp]);

  const handleSelectApp = (app: string) => {
    setSelectedApp(app);
    setSearchActive(false);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleSearch = useCallback(
    async (query: string, type: "grep" | "tag") => {
      setSearchQuery(query);
      setSearchType(type);
      setSearchActive(true);
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
              {selectedApp ?? "Requirements Viewer"}
            </span>
          </div>
        )}

        <Sidebar
          apps={apps}
          selected={selectedApp}
          onSelect={handleSelectApp}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          isMobile={isMobile}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
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
          {searchActive ? (
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
            <AppView key={selectedApp} appName={selectedApp} isMobile={isMobile} />
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
