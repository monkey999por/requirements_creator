import { useEffect, useState } from "react";
import { fetchApps } from "./api";
import { AppView } from "./components/AppView";
import { Sidebar } from "./components/Sidebar";

export function App() {
  const [apps, setApps] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  useEffect(() => {
    fetchApps().then(setApps);
  }, []);

  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      setSelectedApp(apps[0]);
    }
  }, [apps, selectedApp]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar apps={apps} selected={selectedApp} onSelect={setSelectedApp} />
      <main className="flex-1 overflow-hidden">
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
