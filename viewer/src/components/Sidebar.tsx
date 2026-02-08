import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface SidebarProps {
  apps: string[];
  selected: string | null;
  onSelect: (name: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
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

export function Sidebar({
  apps,
  selected,
  onSelect,
  collapsed,
  onToggleCollapse,
  isMobile,
  mobileOpen,
  onMobileClose,
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

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto dark-scrollbar px-3 pb-4">
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600 whitespace-nowrap">
                  Apps
                </p>
                <div className="space-y-0.5">
                  {apps.map((app) => (
                    <button
                      type="button"
                      key={app}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] whitespace-nowrap
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
                          size-1.5 shrink-0 rounded-full
                          ${
                            selected === app
                              ? "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                              : "bg-gray-700"
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
                key={app}
                variants={itemVariants}
                whileHover={{ x: 2 }}
                className={`
                  group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] whitespace-nowrap
                  ${
                    selected === app
                      ? "bg-indigo-500/15 text-indigo-400 font-semibold shadow-lg shadow-indigo-500/5"
                      : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                  }
                `}
                onClick={() => onSelect(app)}
              >
                <motion.span
                  className={`
                    size-1.5 shrink-0 rounded-full
                    ${
                      selected === app
                        ? "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                        : "bg-gray-700 group-hover:bg-gray-500"
                    }
                  `}
                  animate={selected === app ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 0.3 }}
                />
                {app}
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
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800/50">
          <p className="text-[10px] text-gray-700 whitespace-nowrap">requirements_creator</p>
        </div>
      </div>
    </motion.aside>
  );
}
