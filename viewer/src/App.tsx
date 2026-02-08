import { useEffect, useState } from "react";
import { fetchApps } from "./api";
import { AppView } from "./components/AppView";
import { Sidebar } from "./components/Sidebar";
import { useIsMobile } from "./hooks/useIsMobile";

export function App() {
  const [apps, setApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchApps().then(setApps);
  }, []);

  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      setSelectedApp(apps[0]);
    }
  }, [apps, selectedApp]);

  const handleSelectApp = (app: string) => {
    setSelectedApp(app);
    if (isMobile) setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className={`flex-1 overflow-hidden ${isMobile ? "pt-12" : ""}`}>
        {selectedApp ? (
          <AppView key={selectedApp} appName={selectedApp} isMobile={isMobile} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            アプリを選択してください
          </div>
        )}
      </main>
    </div>
  );
}
