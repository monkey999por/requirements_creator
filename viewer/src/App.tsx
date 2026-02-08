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
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar
        apps={apps}
        selected={selectedApp}
        onSelect={setSelectedApp}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <main className="flex-1 overflow-hidden mb-3 mr-3 rounded-2xl bg-gray-900 shadow-2xl shadow-black/50 ring-1 ring-gray-800">
        {selectedApp ? (
          <AppView key={selectedApp} appName={selectedApp} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            アプリを選択してください
          </div>
        )}
      </main>
    </div>
  );
}
