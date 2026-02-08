interface SidebarProps {
  apps: string[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export function Sidebar({ apps, selected, onSelect }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800">
      {/* Header */}
      <div className="px-5 py-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25">
            R
          </span>
          <div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Requirements
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">Viewer</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto dark-scrollbar px-3 pb-4">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600">
          Apps
        </p>
        <div className="space-y-0.5">
          {apps.map((app, i) => (
            <button
              type="button"
              key={app}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`
                group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px]
                transition-all duration-200 animate-slide-right opacity-0
                ${
                  selected === app
                    ? "bg-indigo-500/15 text-indigo-400 font-semibold shadow-lg shadow-indigo-500/5"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                }
              `}
              onClick={() => onSelect(app)}
            >
              <span
                className={`
                  size-1.5 rounded-full transition-all duration-300
                  ${
                    selected === app
                      ? "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                      : "bg-gray-700 group-hover:bg-gray-500"
                  }
                `}
              />
              {app}
            </button>
          ))}
          {apps.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="size-10 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="size-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-xs">アプリがありません</p>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-700">requirements_creator</p>
      </div>
    </aside>
  );
}
