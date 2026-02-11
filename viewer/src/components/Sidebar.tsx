import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import type { AppInfo } from "../api";

interface SidebarProps {
  apps: AppInfo[];
  selected: string | null;
  onSelect: (name: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  viewMode: "apps" | "datasets" | "favorites" | "commands";
  onSelectDatasets: () => void;
  onSelectFavorites: () => void;
  onSelectCommands: () => void;
  onSearch: (query: string, tags: string[]) => void;
  onClearSearch: () => void;
  isSearchActive: boolean;
  allTags: string[];
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.15, ease: "easeOut" } },
};

const SIDEBAR_WIDTH = 256;
const STRIP_WIDTH = 48;

function SearchInput({
  onSearch,
  onClear,
  isActive,
  allTags,
}: {
  onSearch: (query: string, tags: string[]) => void;
  onClear: () => void;
  isActive: boolean;
  allTags: string[];
}) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  const canSearch = query.trim() || selectedTags.length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (canSearch) onSearch(query.trim(), selectedTags);
    },
    [query, selectedTags, canSearch, onSearch],
  );

  const handleClear = () => {
    setQuery("");
    setSelectedTags([]);
    setTagDialogOpen(false);
    onClear();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleTagSearch = () => {
    setTagDialogOpen(false);
    if (query.trim() || selectedTags.length > 0) {
      onSearch(query.trim(), selectedTags);
    }
  };

  return (
    <div className="px-3 pb-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="全文検索..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-800/80 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
          {(query || selectedTags.length > 0 || isActive) && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              onClick={handleClear}
            >
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* タグ指定ボタン */}
        <button
          type="button"
          className={`w-full px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
            selectedTags.length > 0 || tagDialogOpen
              ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
              : "bg-gray-800/50 text-gray-500 hover:text-gray-300"
          }`}
          onClick={() => setTagDialogOpen((prev) => !prev)}
        >
          タグ指定{selectedTags.length > 0 ? ` (${selectedTags.length})` : ""}
        </button>

        {/* 選択中タグのバッジ */}
        {selectedTags.length > 0 && !tagDialogOpen && (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                onClick={() => toggleTag(tag)}
              >
                {tag}
                <svg
                  className="size-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* タグ選択ダイアログ */}
        <AnimatePresence>
          {tagDialogOpen && (
            <motion.div
              className="rounded-lg border border-gray-700/50 bg-gray-800/90 p-2 space-y-1.5"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-[10px] text-gray-500 font-medium">タグを選択（AND検索）</p>
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                        isSelected
                          ? "bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40"
                          : "bg-gray-700/50 text-gray-400 hover:bg-gray-700/80 hover:text-gray-300"
                      }`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="w-full px-2 py-1 text-[10px] font-medium rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canSearch}
                onClick={handleTagSearch}
              >
                検索
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

export function Sidebar({
  apps,
  selected,
  onSelect,
  collapsed,
  onToggleCollapse,
  isMobile,
  mobileOpen,
  onMobileClose,
  viewMode,
  onSelectDatasets,
  onSelectFavorites,
  onSelectCommands,
  onSearch,
  onClearSearch,
  isSearchActive,
  allTags,
}: SidebarProps) {
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;

  /* ── Mobile: overlay sidebar ── */
  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
            />
            {/* Panel */}
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* Header */}
              <div className="px-5 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25">
                    R
                  </span>
                  <button
                    type="button"
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      viewMode === "favorites"
                        ? "text-pink-400 bg-pink-400/10"
                        : "text-gray-500 hover:text-pink-400 hover:bg-pink-400/10"
                    }`}
                    onClick={onSelectFavorites}
                    title="お気に入り"
                  >
                    <svg
                      className="size-5"
                      viewBox="0 0 24 24"
                      fill={viewMode === "favorites" ? "currentColor" : "none"}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      viewMode === "commands"
                        ? "text-cyan-400 bg-cyan-400/10"
                        : "text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/10"
                    }`}
                    onClick={onSelectCommands}
                    title="コマンド実行"
                  >
                    <svg
                      className="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent whitespace-nowrap">
                      Requirements
                    </h1>
                    <p className="text-[10px] text-gray-500 font-medium">Viewer</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors shrink-0"
                  onClick={onMobileClose}
                  title="閉じる"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <SearchInput
                onSearch={onSearch}
                onClear={onClearSearch}
                isActive={isSearchActive}
                allTags={allTags}
              />

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto dark-scrollbar px-3 pb-4">
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600 whitespace-nowrap">
                  Apps
                </p>
                <div className="space-y-0.5">
                  {apps.map((app) => (
                    <button
                      type="button"
                      key={app.name}
                      className={`
                        w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-[13px] text-left
                        ${
                          selected === app.name
                            ? "bg-indigo-500/15 text-indigo-400 font-semibold shadow-lg shadow-indigo-500/5"
                            : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                        }
                      `}
                      onClick={() => onSelect(app.name)}
                    >
                      <span
                        className={`
                          size-1.5 shrink-0 rounded-full mt-1.5
                          ${
                            selected === app.name
                              ? "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                              : "bg-gray-700"
                          }
                        `}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{app.name}</span>
                        {app.tags.length > 0 && (
                          <span className="flex gap-1 mt-0.5">
                            {app.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium bg-gray-800/80 text-gray-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
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

                {/* Datasets */}
                <p className="px-3 mt-6 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600 whitespace-nowrap">
                  Datasets
                </p>
                <button
                  type="button"
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] whitespace-nowrap
                    ${
                      viewMode === "datasets"
                        ? "bg-amber-500/15 text-amber-400 font-semibold shadow-lg shadow-amber-500/5"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                    }
                  `}
                  onClick={onSelectDatasets}
                >
                  <svg
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${viewMode === "datasets" ? "text-amber-400" : "text-gray-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  データセット管理
                </button>
              </nav>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-800/50">
                <p className="text-[10px] text-gray-700 whitespace-nowrap">requirements_creator</p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  /* ── Desktop: collapsible sidebar ── */
  return (
    <motion.aside
      className="shrink-0 h-full overflow-hidden bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-gray-800"
      animate={{ width: expanded ? SIDEBAR_WIDTH : STRIP_WIDTH }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-full flex flex-col" style={{ width: SIDEBAR_WIDTH }}>
        {/* Header */}
        <div className="px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25">
              R
            </span>
            <motion.button
              type="button"
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                viewMode === "favorites"
                  ? "text-pink-400 bg-pink-400/10"
                  : "text-gray-500 hover:text-pink-400 hover:bg-pink-400/10"
              }`}
              onClick={onSelectFavorites}
              title="お気に入り"
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill={viewMode === "favorites" ? "currentColor" : "none"}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
            </motion.button>
            <motion.button
              type="button"
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                viewMode === "commands"
                  ? "text-cyan-400 bg-cyan-400/10"
                  : "text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/10"
              }`}
              onClick={onSelectCommands}
              title="コマンド実行"
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </motion.button>
            <motion.div animate={{ opacity: expanded ? 1 : 0 }} transition={{ duration: 0.2 }}>
              <h1 className="text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent whitespace-nowrap">
                Requirements
              </h1>
              <p className="text-[10px] text-gray-500 font-medium">Viewer</p>
            </motion.div>
          </div>
          <motion.button
            type="button"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors shrink-0"
            onClick={onToggleCollapse}
            title={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {collapsed ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              )}
            </svg>
          </motion.button>
        </div>

        {/* Search */}
        <motion.div animate={{ opacity: expanded ? 1 : 0 }} transition={{ duration: 0.2 }}>
          {expanded && (
            <SearchInput
              onSearch={onSearch}
              onClear={onClearSearch}
              isActive={isSearchActive}
              allTags={allTags}
            />
          )}
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto dark-scrollbar px-3 pb-4">
          <motion.p
            className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600 whitespace-nowrap"
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            Apps
          </motion.p>
          <motion.div
            key={apps.length}
            className="space-y-0.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {apps.map((app) => (
              <motion.button
                type="button"
                key={app.name}
                variants={itemVariants}
                whileHover={{ x: 2 }}
                className={`
                  group w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-[13px] text-left
                  ${
                    selected === app.name
                      ? "bg-indigo-500/15 text-indigo-400 font-semibold shadow-lg shadow-indigo-500/5"
                      : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                  }
                `}
                onClick={() => onSelect(app.name)}
              >
                <motion.span
                  className={`
                    size-1.5 shrink-0 rounded-full mt-1.5
                    ${
                      selected === app.name
                        ? "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                        : "bg-gray-700 group-hover:bg-gray-500"
                    }
                  `}
                  animate={selected === app.name ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 0.3 }}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate whitespace-nowrap">{app.name}</span>
                  {app.tags.length > 0 && (
                    <span className="flex gap-1 mt-0.5">
                      {app.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium bg-gray-800/80 text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </motion.button>
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
          </motion.div>

          {/* Datasets */}
          <motion.p
            className="px-3 mt-6 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600 whitespace-nowrap"
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            Datasets
          </motion.p>
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            className={`
              group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] whitespace-nowrap
              ${
                viewMode === "datasets"
                  ? "bg-amber-500/15 text-amber-400 font-semibold shadow-lg shadow-amber-500/5"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
              }
            `}
            onClick={onSelectDatasets}
          >
            <svg
              aria-hidden="true"
              className={`size-4 shrink-0 ${viewMode === "datasets" ? "text-amber-400" : "text-gray-600 group-hover:text-gray-500"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            データセット管理
          </motion.button>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800/50">
          <p className="text-[10px] text-gray-700 whitespace-nowrap">requirements_creator</p>
        </div>
      </div>
    </motion.aside>
  );
}
