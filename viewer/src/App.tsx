import { useEffect, useState } from "react";
import { fetchApps } from "./api";
import { AppView } from "./components/AppView";
import { Sidebar } from "./components/Sidebar";

export function App() {
  const [apps, setApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchApps().then(setApps);
  }, []);

  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      setSelectedApp(apps[0]);
    }
  }, [apps, selectedApp]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <Sidebar
        apps={apps}
        selected={selectedApp}
        onSelect={setSelectedApp}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <main className="flex-1 overflow-hidden m-3 ml-0 rounded-2xl bg-white shadow-xl shadow-gray-300/50 ring-1 ring-gray-200/60">
        {selectedApp ? (
          <AppView key={selectedApp} appName={selectedApp} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            アプリを選択してください
          </div>
        )}
      </main>
    </div>
  );
}
