import { useEffect, useState } from "react";
import { fetchApps, fetchMode } from "./api";
import { AppView } from "./components/AppView";
import { DatasetManager } from "./components/DatasetManager";
import { Sidebar } from "./components/Sidebar";
import { useIsMobile } from "./hooks/useIsMobile";

type ViewMode = "apps" | "datasets";

export function App() {
  const [apps, setApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("apps");
  const [isDev, setIsDev] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchApps().then(setApps);
    fetchMode().then((r) => setIsDev(r.isDev));
  }, []);

  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get("app");
      setSelectedApp(appParam && apps.includes(appParam) ? appParam : apps[0]);
    }
  }, [apps, selectedApp]);

  useEffect(() => {
    if (selectedApp && viewMode === "apps") {
      const url = new URL(window.location.href);
      url.searchParams.set("app", selectedApp);
      url.searchParams.delete("view");
      window.history.replaceState({}, "", url.toString());
    }
    if (viewMode === "datasets") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "datasets");
      url.searchParams.delete("app");
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedApp, viewMode]);

  const handleSelectApp = (app: string) => {
    setSelectedApp(app);
    setViewMode("apps");
    if (isMobile) setMobileSidebarOpen(false);
  };

  const handleSelectDatasets = () => {
    setViewMode("datasets");
    if (isMobile) setMobileSidebarOpen(false);
  };

  return (
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
      />

      <main
        className={`flex-1 overflow-hidden ${
          isMobile
            ? "pt-12 bg-gray-900"
            : "mb-3 mr-3 rounded-2xl bg-gray-900 shadow-2xl shadow-black/50 ring-1 ring-gray-800"
        }`}
      >
        {viewMode === "datasets" ? (
          <DatasetManager isMobile={isMobile} isDev={isDev} />
        ) : selectedApp ? (
          <AppView key={selectedApp} appName={selectedApp} isMobile={isMobile} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            アプリを選択してください
          </div>
        )}
      </main>
    </div>
  );
}
